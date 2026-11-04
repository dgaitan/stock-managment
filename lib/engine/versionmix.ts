// Puro, sin Next/React/DB. Propuesta de mezcla por versión dentro de un pedido
// ya calculado por modelo (la fábrica acepta cualquier mezcla). Reparte las
// unidades en proporción a ventas + leads perdidos por falta de stock de los
// últimos meses de la ventana. No cambia el total del pedido ni toca el color.

import type { EngineFactoryOrder, EngineLead, EngineSale } from "@/lib/engine/inputs";
import { addMonths, compareMonthKeys, monthKey } from "@/lib/engine/months";
import { isInTransitAtCutoff } from "@/lib/engine/stockprojection";

export interface VersionMixRow {
  version: string;
  salesInWindow: number;
  lostByStockInWindow: number;
  inTransit: number;
  suggested: number;
}

const NO_VERSION = "Sin versión";

/** Reparte `total` en enteros proporcionales a `weights` (mayor resto). */
export function allocateProportionally(total: number, weights: number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const result = exact.map(Math.floor);
  let remaining = total - result.reduce((acc, n) => acc + n, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (remaining <= 0) break;
    result[index] += 1;
    remaining -= 1;
  }
  return result;
}

export function suggestVersionMix(params: {
  modelName: string;
  orderUnits: number;
  cutoffDate: string;
  windowMonths: number;
  sales: EngineSale[];
  leads: EngineLead[];
  factoryOrders: EngineFactoryOrder[];
}): VersionMixRow[] {
  const { modelName, orderUnits, cutoffDate, windowMonths, sales, leads, factoryOrders } = params;
  const cutoffMonth = monthKey(cutoffDate);
  const firstMonth = addMonths(cutoffMonth, -(windowMonths - 1));
  const inWindow = (isoDate: string | null) => {
    if (!isoDate) return false;
    const month = monthKey(isoDate);
    return compareMonthKeys(month, firstMonth) >= 0 && compareMonthKeys(month, cutoffMonth) <= 0;
  };

  const byVersion = new Map<string, Omit<VersionMixRow, "version" | "suggested">>();
  const row = (version: string | null) => {
    const key = version ?? NO_VERSION;
    let entry = byVersion.get(key);
    if (!entry) {
      entry = { salesInWindow: 0, lostByStockInWindow: 0, inTransit: 0 };
      byVersion.set(key, entry);
    }
    return entry;
  };

  for (const sale of sales) {
    if (sale.modelName === modelName && !sale.isFleetOutlier && inWindow(sale.date)) row(sale.version).salesInWindow += sale.units;
  }
  for (const lead of leads) {
    if (lead.modelName !== modelName || lead.result !== "Perdida" || lead.lossReasonCategory !== "stock") continue;
    if (inWindow(lead.closedAt)) row(lead.version).lostByStockInWindow += lead.units;
  }
  for (const order of factoryOrders) {
    if (isInTransitAtCutoff(order, modelName, cutoffDate)) row(order.version).inTransit += order.units;
  }

  const entries = [...byVersion.entries()].map(([version, values]) => ({ version, ...values }));
  const allocation = allocateProportionally(
    orderUnits,
    entries.map((e) => Math.max(0, e.salesInWindow) + e.lostByStockInWindow),
  );
  return entries
    .map((entry, index) => ({ ...entry, suggested: allocation[index] }))
    .sort((a, b) => b.suggested - a.suggested || a.version.localeCompare(b.version));
}
