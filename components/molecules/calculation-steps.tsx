import { InfoTip } from "@/components/molecules/info-tip";
import { formatMonthRangeLabel } from "@/lib/engine/explain";
import { formatDecimal, formatInt, formatUsd } from "@/lib/format";
import type { OrderLineDetail } from "@/lib/orders/types";

function Step({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-[13px]">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        {hint ? <InfoTip label={`Qué significa: ${label}`}>{hint}</InfoTip> : null}
      </dt>
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
    <section className="flex flex-col gap-1">
      <h3 className="flex items-center gap-1 text-sm font-semibold">
        Cálculo paso a paso
        <InfoTip label="Fórmula del pedido">
          Necesidad = demanda {coverage} + seguridad − stock a {arrival}. El pedido es la necesidad redondeada al lote
          (mínimo y múltiplo).
        </InfoTip>
      </h3>
      <dl>
        <Step label="Patio + tránsito" value={`${formatInt(plan.patioAtCutoff)} + ${formatInt(plan.transitoAtCutoff)}`} />
        <Step label={`Demanda ${gap}`} value={`${formatDecimal(plan.demandGap)} u.`} />
        <Step
          label={`Stock a ${arrival}`}
          value={`${formatDecimal(plan.projectedStockAtArrival)} u.`}
          hint="Simulación mes a mes con las llegadas (ETA); nunca baja de 0."
        />
        <Step
          label="Demanda no atendida"
          value={`${formatDecimal(plan.unmetDemandGap)} u.`}
          hint={`Ventas que se pierden entre ${gap} por falta de stock. No se suman al pedido.`}
        />
        <Step label={`Demanda ${coverage}`} value={`${formatDecimal(plan.demandCoverageWindow)} u.`} />
        <Step label="Stock de seguridad" value={`${formatDecimal(plan.safetyStockUnits)} u.`} />
        <Step
          label="Necesidad"
          value={`${formatDecimal(plan.demandCoverageWindow)} + ${formatDecimal(plan.safetyStockUnits)} − ${formatDecimal(plan.projectedStockAtArrival)} = ${formatDecimal(plan.need)}`}
        />
        <Step
          label="Redondeo a lote"
          value={`${formatDecimal(Math.max(plan.need, 0))} → ${formatInt(plan.orderUnits)}`}
          hint={`Lote del modelo: mínimo ${lot.min}, múltiplo ${lot.multiple}.`}
        />
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
