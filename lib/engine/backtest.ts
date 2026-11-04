// Puro, sin Next/React/DB. Backtest del pronóstico: corre el motor con
// cortes pasados usando solo datos anteriores al corte y compara el
// pronóstico de la ventana de cobertura (la que cubriría el pedido de ese
// corte) contra lo que realmente pasó. Ver docs/PLAN.md, paso 9.

import type { CycleConfig, ModelConfig } from "@/lib/engine/config";
import { type Cycle, deriveCycle } from "@/lib/engine/cycle";
import { computeMonthlyCorrectedDemand } from "@/lib/engine/demand";
import { addMonths, monthKey, monthRange } from "@/lib/engine/months";
import { computeModelOrderPlan, type ModelEconomics } from "@/lib/engine/order";
import type {
  NormalizedFactoryOrder,
  NormalizedInventorySnapshot,
  NormalizedLead,
  NormalizedSale,
} from "@/lib/sources/types";

export interface BacktestData {
  sales: NormalizedSale[];
  leads: NormalizedLead[];
  inventory: NormalizedInventorySnapshot[];
  factoryOrders: NormalizedFactoryOrder[];
}

export interface BacktestRow {
  cutoff: string;
  modelName: string;
  months: string[]; // meses de la ventana evaluados (solo los que ya tienen datos)
  forecast: number; // unidades pronosticadas en esos meses
  actualSales: number; // ventas netas reales sin flota (recortadas si hubo quiebre)
  actualCorrected: number; // demanda corregida real (ventas + leads perdidos por stock + sustitución, sin imputar)
  naive: number; // referencia: promedio mensual de las ventas de los 12 meses previos al corte x meses
  partial: boolean; // la ventana no tiene todos sus meses con datos
}

/** Solo lo que se sabía al corte: ventas, leads cerrados, inventario y pedidos hechos hasta esa fecha. */
export function sliceDataAtCutoff(data: BacktestData, cutoffDate: string): BacktestData {
  return {
    sales: data.sales.filter((s) => s.date <= cutoffDate),
    leads: data.leads.filter((l) => l.closedAt !== null && l.closedAt <= cutoffDate),
    inventory: data.inventory.filter((i) => i.monthEnd <= cutoffDate),
    factoryOrders: data.factoryOrders.filter((o) => o.orderDate !== null && o.orderDate <= cutoffDate),
  };
}

function netSalesInMonths(modelName: string, sales: NormalizedSale[], months: Set<string>): number {
  let total = 0;
  for (const s of sales) {
    if (s.modelName === modelName && !s.isFleetOutlier && months.has(monthKey(s.date))) total += s.units;
  }
  return total;
}

/** Referencia ingenua: venta mensual promedio (sin flota) de los 12 meses que terminan en el corte. */
export function naiveMonthlyRate(modelName: string, sales: NormalizedSale[], cutoffMonth: string): number {
  const last12 = new Set(monthRange(addMonths(cutoffMonth, -11), 12));
  return netSalesInMonths(modelName, sales, last12) / 12;
}

/**
 * Corre el motor en cada corte con los datos disponibles a esa fecha y
 * compara la ventana de cobertura contra los datos completos. Los meses
 * posteriores a `dataEndMonth` no existen todavía: se omiten y la fila se
 * marca como parcial.
 */
export function runBacktest(params: {
  config: CycleConfig;
  models: ModelConfig[];
  data: BacktestData;
  economicsByModel: Map<string, ModelEconomics>;
  dataEndMonth: string;
}): BacktestRow[] {
  const { config, models, data, economicsByModel, dataEndMonth } = params;
  const rows: BacktestRow[] = [];

  for (const cutoff of config.backtest_cutoffs) {
    const known = sliceDataAtCutoff(data, cutoff);
    const cutoffMonth = monthKey(cutoff);
    const cycle = deriveCycle({
      cutoffDate: cutoff,
      leadTimeMonths: config.lead_time_months,
      windowMonths: config.window_months,
    });

    for (const model of models) {
      rows.push(
        backtestModel({
          config,
          cycle,
          model,
          known,
          full: data,
          economics: economicsByModel.get(model.name) ?? { unitCost: 0, marginPct: 0, monthlyFinCost: 0 },
          cutoff,
          cutoffMonth,
          dataEndMonth,
        }),
      );
    }
  }
  return rows;
}

function backtestModel(params: {
  config: CycleConfig;
  cycle: Cycle;
  model: ModelConfig;
  known: BacktestData;
  full: BacktestData;
  economics: ModelEconomics;
  cutoff: string;
  cutoffMonth: string;
  dataEndMonth: string;
}): BacktestRow {
  const { config, cycle, model, known, full, economics, cutoff, cutoffMonth, dataEndMonth } = params;

  const plan = computeModelOrderPlan({ config, cycle, model, economics, ...known });
  const available = plan.coverageMonths.filter((m) => m <= dataEndMonth);
  const availableSet = new Set(available);

  const forecast = plan.forecastByMonth;
  const forecastUnits = available.reduce((acc, m) => acc + (forecast[m] ?? 0), 0);
  const corrected = computeMonthlyCorrectedDemand(model.name, full.sales, full.leads, available);

  return {
    cutoff,
    modelName: model.name,
    months: available,
    forecast: forecastUnits,
    actualSales: netSalesInMonths(model.name, full.sales, availableSet),
    actualCorrected: corrected.reduce((acc, p) => acc + p.correctedDemand, 0),
    naive: naiveMonthlyRate(model.name, known.sales, cutoffMonth) * available.length,
    partial: available.length < plan.coverageMonths.length,
  };
}

export interface ErrorMetrics {
  wape: number | null; // sum|F-A| / sumA; null si no hay demanda real
  bias: number | null; // (sumF - sumA) / sumA; negativo = sub-pronóstico
}

/** WAPE y sesgo de un conjunto de pares (pronóstico, real). */
export function computeErrorMetrics(pairs: { forecast: number; actual: number }[]): ErrorMetrics {
  const totalActual = pairs.reduce((acc, p) => acc + p.actual, 0);
  if (totalActual <= 0) return { wape: null, bias: null };
  const absError = pairs.reduce((acc, p) => acc + Math.abs(p.forecast - p.actual), 0);
  const signedError = pairs.reduce((acc, p) => acc + (p.forecast - p.actual), 0);
  return { wape: absError / totalActual, bias: signedError / totalActual };
}
