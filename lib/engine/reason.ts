// Puro, sin Next/React/DB. Motivo de una línea para la tabla «Pedido sugerido»:
// una insignia solo en excepciones (quiebre, inventario viejo, fin de
// generación) y el dato que más pesa. El detalle completo vive en explain.ts.

import { FLAG_LABELS, monthLabel } from "@/lib/engine/explain";
import type { ModelOrderPlan } from "@/lib/engine/order";
import type { StockAging } from "@/lib/engine/aging";

export type ReasonBadge = "quiebre" | "antiguedad" | "fin_generacion";

export interface OrderReason {
  badge: ReasonBadge | null;
  text: string;
}

function round0(value: number): number {
  return Math.round(value);
}

export function summarizeReason(plan: ModelOrderPlan, aging: StockAging): OrderReason {
  const arrival = monthLabel(plan.arrivalMonth);
  const stock = `Stock a ${arrival}: ${round0(plan.projectedStockAtArrival)} u.`;

  if (plan.flags.includes("ultima_ventana_de_generacion") && plan.orderUnits === 0) {
    const lastCovered = plan.coverageMonths[plan.coverageMonths.length - 1];
    return {
      badge: "fin_generacion",
      text: `El tránsito cubre hasta ${monthLabel(lastCovered)}-${lastCovered.slice(0, 4)}`,
    };
  }
  if (plan.imputedStockoutMonths > 0 && plan.patioAtCutoff === 0) {
    const months = plan.imputedStockoutMonths;
    return {
      badge: "quiebre",
      text: `Sin unidades en patio; demanda oculta en ${months} ${months === 1 ? "mes" : "meses"} de quiebre`,
    };
  }
  if (aging.agedUnits > 0 && aging.thresholdDays !== null) {
    return { badge: "antiguedad", text: `${stock}; ${aging.agedUnits} u. con más de ${aging.thresholdDays} días` };
  }
  const atMinimum = plan.flags.includes("pedido_minimo_del_lote") ? `; ${FLAG_LABELS.pedido_minimo_del_lote}` : "";
  return { badge: null, text: `${stock}${atMinimum}` };
}
