// Puro, sin Next/React/DB. Antigüedad del patio de un modelo al corte. El umbral
// de «inventario viejo» es el primer escalón de descuento por antigüedad
// (aging_discounts en config/cycle.yaml): una sola fuente.

import type { EngineInventoryRow } from "@/lib/engine/inputs";
import { monthKey } from "@/lib/engine/months";

export interface StockAging {
  agedUnits: number; // unidades en filas con antigüedad promedio >= umbral
  avgAgeDays: number | null; // antigüedad promedio ponderada por unidades
  thresholdDays: number | null;
}

export function agingThresholdDays(agingDiscounts: Record<string, number>): number | null {
  const days = Object.keys(agingDiscounts).map(Number).filter(Number.isFinite);
  return days.length === 0 ? null : Math.min(...days);
}

export function summarizeStockAging(params: {
  modelName: string;
  inventory: EngineInventoryRow[];
  cutoffDate: string;
  thresholdDays: number | null;
}): StockAging {
  const { modelName, inventory, cutoffDate, thresholdDays } = params;
  const cutoffMonth = monthKey(cutoffDate);
  let agedUnits = 0;
  let weightedAge = 0;
  let agedKnownUnits = 0;
  for (const row of inventory) {
    if (row.modelName !== modelName || monthKey(row.monthEnd) !== cutoffMonth || row.avgAgeDays === null) continue;
    agedKnownUnits += row.units;
    weightedAge += row.units * row.avgAgeDays;
    if (thresholdDays !== null && row.avgAgeDays >= thresholdDays) agedUnits += row.units;
  }
  return {
    agedUnits,
    avgAgeDays: agedKnownUnits > 0 ? Math.round(weightedAge / agedKnownUnits) : null,
    thresholdDays,
  };
}
