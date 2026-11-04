// Puro, sin Next/React/DB. Cuadra el flujo de stock mensual por modelo
// (inventario inicial + llegadas - ventas ~= inventario final) y marca
// los meses de quiebre (stock en 0, por debajo de medio mes de demanda,
// o con leads perdidos por falta de inventario). Ver docs/PLAN.md
// "Lógica del motor de pedido", pasos 2 y 3.

import { addMonths, monthKey } from "@/lib/engine/months";
import type {
  EngineFactoryOrder,
  EngineInventoryRow,
  EngineLead,
  EngineSale,
} from "@/lib/engine/inputs";

export interface StockFlowMonth {
  month: string; // "YYYY-MM"
  openingStock: number | null; // null si el mes anterior no tiene snapshot
  arrivals: number;
  netSalesUnits: number;
  closingStockReported: number;
  closingStockExpected: number | null;
  discrepancy: number | null; // reportado - esperado; alerta de calidad si != 0
  leadsLostStock: number;
  isStockout: boolean;
}

function sumUnits<T>(rows: T[], predicate: (row: T) => boolean, unitsOf: (row: T) => number): number {
  let total = 0;
  for (const row of rows) {
    if (predicate(row)) total += unitsOf(row);
  }
  return total;
}

/** Promedio mensual de ventas netas (sin flota) del modelo, usado como referencia de "medio mes de demanda". */
export function computeAvgMonthlyNetSales(modelName: string, sales: EngineSale[]): number {
  const monthly = new Map<string, number>();
  for (const sale of sales) {
    if (sale.modelName !== modelName || sale.isFleetOutlier) continue;
    const m = monthKey(sale.date);
    monthly.set(m, (monthly.get(m) ?? 0) + sale.units);
  }
  if (monthly.size === 0) return 0;
  const total = [...monthly.values()].reduce((a, b) => a + b, 0);
  return total / monthly.size;
}

/** Stock en patio al cierre de cada mes con snapshot de inventario del modelo ("YYYY-MM" -> unidades). */
export function closingStockByMonth(
  modelName: string,
  inventory: EngineInventoryRow[],
): Map<string, number> {
  const closing = new Map<string, number>();
  for (const row of inventory) {
    if (row.modelName !== modelName) continue;
    const month = monthKey(row.monthEnd);
    closing.set(month, (closing.get(month) ?? 0) + row.units);
  }
  return closing;
}

/**
 * Construye la serie mensual de cuadre de stock para un modelo, a partir
 * de los meses con snapshot de inventario. Las llegadas se toman de
 * pedidos a fábrica con fecha de recepción en el mes; las ventas, de
 * todas las líneas del modelo en el mes (incluye el ajuste de notas de
 * crédito, que ya vienen en negativo).
 */
export function buildMonthlyStockFlow(params: {
  modelName: string;
  sales: EngineSale[];
  inventory: EngineInventoryRow[];
  factoryOrders: EngineFactoryOrder[];
  leads: EngineLead[];
}): StockFlowMonth[] {
  const { modelName, sales, inventory, factoryOrders, leads } = params;

  const closingByMonth = closingStockByMonth(modelName, inventory);
  const months = [...closingByMonth.keys()].sort();
  const avgMonthlyDemand = computeAvgMonthlyNetSales(modelName, sales);

  return months.map((month) => {
    const closingStockReported = closingByMonth.get(month) ?? 0;
    const prevMonth = addMonths(month, -1);
    const openingStock = closingByMonth.has(prevMonth) ? closingByMonth.get(prevMonth)! : null;

    const arrivals = sumUnits(
      factoryOrders,
      (o) => o.modelName === modelName && o.receivedAt !== null && monthKey(o.receivedAt) === month,
      (o) => o.units,
    );

    const netSalesUnits = sumUnits(
      sales,
      (s) => s.modelName === modelName && monthKey(s.date) === month,
      (s) => s.units,
    );

    const closingStockExpected = openingStock !== null ? openingStock + arrivals - netSalesUnits : null;
    const discrepancy = closingStockExpected !== null ? closingStockReported - closingStockExpected : null;

    const leadsLostStock = sumUnits(
      leads,
      (l) =>
        l.modelName === modelName &&
        l.lossReasonCategory === "stock" &&
        l.result === "Perdida" &&
        l.closedAt !== null &&
        monthKey(l.closedAt) === month,
      (l) => l.units,
    );

    const isStockout =
      closingStockReported === 0 ||
      leadsLostStock > 0 ||
      (avgMonthlyDemand > 0 && closingStockReported < avgMonthlyDemand / 2);

    return {
      month,
      openingStock,
      arrivals,
      netSalesUnits,
      closingStockReported,
      closingStockExpected,
      discrepancy,
      leadsLostStock,
      isStockout,
    };
  });
}
