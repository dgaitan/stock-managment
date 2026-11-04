import { formatMonthRangeLabel } from "@/lib/engine/explain";
import { formatDecimal, formatInt, formatUsd } from "@/lib/format";
import type { OrderLineDetail } from "@/lib/orders/types";

function Step({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function CalculationSteps({ detail, capital }: { detail: OrderLineDetail; capital: number }) {
  const { plan, lot } = detail;
  const gap = formatMonthRangeLabel(plan.gapMonths);
  const coverage = formatMonthRangeLabel(plan.coverageMonths);
  const arrival = formatMonthRangeLabel([plan.arrivalMonth]);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Cálculo paso a paso</h3>
      <dl>
        <Step label="Patio + tránsito" value={`${formatInt(plan.patioAtCutoff)} + ${formatInt(plan.transitoAtCutoff)}`} />
        <Step label={`Demanda proyectada ${gap}`} value={`${formatDecimal(plan.demandGap)} u.`} />
        <Step label={`Stock a ${arrival} (mes a mes, nunca menor a 0)`} value={`${formatDecimal(plan.projectedStockAtArrival)} u.`} />
        <Step
          label={`Demanda no atendida ${gap}`}
          value={`${formatDecimal(plan.unmetDemandGap)} u. · venta perdida, no se suma al pedido`}
        />
        <Step label={`Demanda ${coverage}`} value={`${formatDecimal(plan.demandCoverageWindow)} u.`} />
        <Step label="Stock de seguridad" value={`${formatDecimal(plan.safetyStockUnits)} u.`} />
        <Step
          label="Necesidad"
          value={`${formatDecimal(plan.demandCoverageWindow)} + ${formatDecimal(plan.safetyStockUnits)} − ${formatDecimal(plan.projectedStockAtArrival)} = ${formatDecimal(plan.need)}`}
        />
        <Step label={`Lote (mín ${lot.min} / múltiplo ${lot.multiple})`} value={`${formatDecimal(Math.max(plan.need, 0))} → ${formatInt(plan.orderUnits)}`} />
      </dl>
      <p className="flex justify-between pt-2 font-semibold">
        <span>Pedido sugerido</span>
        <span>
          {formatInt(plan.orderUnits)} unidades · US$ {formatUsd(capital)}
        </span>
      </p>
    </section>
  );
}
