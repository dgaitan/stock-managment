// Puro, sin Next/React/DB. Imputa la demanda de los meses de quiebre: si
// un modelo estuvo (casi) sin stock, sus ventas están recortadas por la
// falta de unidades, no por falta de clientes. En esos meses la demanda
// corregida se sube, como mínimo, al promedio de los meses sin quiebre.
// Ver docs/PLAN.md "Lógica del motor de pedido", paso 4.

import type { MonthlyDemandPoint } from "@/lib/engine/demand";

export interface ImputationResult {
  history: MonthlyDemandPoint[];
  imputedMonths: string[]; // meses de quiebre cuya demanda se subió
  baselineDemand: number; // promedio de demanda corregida de los meses sin quiebre
}

/**
 * Un mes es de quiebre si su stock al cierre (0 si no hay snapshot) es
 * menor a `minStockFraction` de la venta mensual promedio del modelo.
 * La demanda de esos meses se sube al promedio de los meses sin quiebre;
 * nunca se baja. Sin ningún mes sin quiebre no hay base y no se imputa.
 */
export function imputeStockoutDemand(params: {
  history: MonthlyDemandPoint[];
  closingStockByMonth: Map<string, number>;
  avgMonthlyNetSales: number;
  minStockFraction: number;
}): ImputationResult {
  const { history, closingStockByMonth, avgMonthlyNetSales, minStockFraction } = params;
  const stockoutThreshold = avgMonthlyNetSales * minStockFraction;
  const isStockout = (month: string) => (closingStockByMonth.get(month) ?? 0) < stockoutThreshold;

  const healthy = history.filter((p) => !isStockout(p.month));
  if (healthy.length === 0 || healthy.length === history.length) {
    return { history, imputedMonths: [], baselineDemand: 0 };
  }
  const baselineDemand = healthy.reduce((acc, p) => acc + p.correctedDemand, 0) / healthy.length;

  const imputedMonths: string[] = [];
  const imputed = history.map((point) => {
    if (!isStockout(point.month) || point.correctedDemand >= baselineDemand) return point;
    imputedMonths.push(point.month);
    return { ...point, correctedDemand: baselineDemand };
  });

  return { history: imputed, imputedMonths, baselineDemand };
}
