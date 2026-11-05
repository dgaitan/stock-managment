import { monthLabel } from "@/lib/engine/explain";
import { formatDecimal, formatInt, formatUsd } from "@/lib/format";
import type { OrderLineDetail } from "@/lib/orders/types";

/** ["2026-10", …, "2027-01"] -> "oct–ene" (como en el diseño, sin año). */
function monthSpan(months: string[]): string {
  const first = monthLabel(months[0]);
  const last = monthLabel(months[months.length - 1]);
  return first === last ? first : `${first}–${last}`;
}

function Step({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-hairline py-[9px] text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function CalculationSteps({ detail, capital }: { detail: OrderLineDetail; capital: number }) {
  const { plan, lot } = detail;
  const gap = monthSpan(plan.gapMonths);
  const coverage = monthSpan(plan.coverageMonths);
  const arrival = monthLabel(plan.arrivalMonth);
  const available = plan.patioAtCutoff + plan.transitoAtCutoff;
  const stockOut = plan.unmetDemandGap > 0;

  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold">Cálculo paso a paso</h3>
      <div className="mb-1.5 rounded-lg bg-muted px-3.5 py-3 font-mono text-xs leading-[1.8]">
        Stock a {arrival} = simulación mes a mes con las llegadas (ETA), nunca menor a 0
        <br />
        Necesidad = demanda {coverage} + seguridad − stock a {arrival}
        <br />
        Pedido = redondeo hacia arriba al lote (mín / múltiplo)
      </div>
      <dl>
        <Step
          label="Patio + tránsito"
          value={`${formatInt(plan.patioAtCutoff)} + ${formatInt(plan.transitoAtCutoff)} = ${formatInt(available)}`}
        />
        <Step label={`Demanda proyectada ${gap}`} value={`${formatDecimal(plan.demandGap)} u.`} />
        <Step
          label={`Stock a ${arrival}`}
          value={
            stockOut
              ? `${formatInt(available)} − ${formatDecimal(plan.demandGap)} → 0 (se agota)`
              : `${formatDecimal(plan.projectedStockAtArrival)} u.`
          }
        />
        {stockOut ? (
          <Step
            label={`Demanda no atendida ${gap}`}
            value={`${formatDecimal(plan.unmetDemandGap)} u. · venta perdida, no se suma al pedido`}
          />
        ) : null}
        <Step label={`Demanda ${coverage}`} value={`${formatDecimal(plan.demandCoverageWindow)} u.`} />
        <Step label="Stock de seguridad" value={`${formatDecimal(plan.safetyStockUnits)} u.`} />
        <Step
          label="Necesidad"
          value={`${formatDecimal(plan.demandCoverageWindow)} + ${formatDecimal(plan.safetyStockUnits)} − ${formatDecimal(plan.projectedStockAtArrival)} = ${formatDecimal(plan.need)}`}
        />
        <Step
          label={`Redondeo a lote (mín ${lot.min} / múltiplo ${lot.multiple})`}
          value={`${formatDecimal(Math.max(plan.need, 0))} → ${formatInt(plan.orderUnits)}`}
        />
      </dl>
      <p className="flex justify-between py-3 font-semibold">
        <span>Pedido sugerido</span>
        <span>
          {formatInt(plan.orderUnits)} unidades · US$ {formatUsd(capital)}
        </span>
      </p>
    </section>
  );
}
