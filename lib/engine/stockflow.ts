// Puro, sin Next/React/DB. Cuadra el flujo de stock mensual por modelo
// (inventario inicial + llegadas - ventas ~= inventario final) y marca
// los meses de quiebre (stock en 0, por debajo de medio mes de demanda,
// o con leads perdidos por falta de inventario). Ver docs/PLAN.md
// "Lógica del motor de pedido", pasos 2 y 3.

import { addMonths, monthKey } from "@/lib/engine/months";
import type {
  NormalizedFactoryOrder,
  NormalizedInventorySnapshot,
  NormalizedLead,
  NormalizedSale,
} from "@/lib/sources/types";

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
export function computeAvgMonthlyNetSales(modelName: string, sales: NormalizedSale[]): number {
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

/**
 * Construye la serie mensual de cuadre de stock para un modelo, a partir
 * de los meses con snapshot de inventario. Las llegadas se toman de
 * pedidos a fábrica con fecha de recepción en el mes; las ventas, de
 * todas las líneas del modelo en el mes (incluye el ajuste de notas de
 * crédito, que ya vienen en negativo).
 */
export function buildMonthlyStockFlow(params: {
  modelName: string;
  sales: NormalizedSale[];
  inventory: NormalizedInventorySnapshot[];
  factoryOrders: NormalizedFactoryOrder[];
  leads: NormalizedLead[];
}): StockFlowMonth[] {
  const { modelName, sales, inventory, factoryOrders, leads } = params;

  const inventoryMonths = new Set(
    inventory.filter((r) => r.modelName === modelName).map((r) => monthKey(r.monthEnd)),
  );
  const months = [...inventoryMonths].sort();
  const avgMonthlyDemand = computeAvgMonthlyNetSales(modelName, sales);

  const closingByMonth = new Map<string, number>();
  for (const m of months) {
    closingByMonth.set(
      m,
      sumUnits(
        inventory,
        (r) => r.modelName === modelName && monthKey(r.monthEnd) === m,
        (r) => r.units,
      ),
    );
  }

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
