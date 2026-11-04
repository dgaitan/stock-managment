// Puro, sin Next/React/DB. Orquesta demand + forecast para calcular el
// pedido por modelo: proyecta el stock al mes de llegada, calcula la
// necesidad para la ventana de cobertura, aplica el colchón de seguridad y
// redondea al mínimo/múltiplo de lote. Ver docs/PLAN.md "Lógica del
// motor de pedido", pasos 6-8.

import type { CycleConfig, ModelConfig } from "@/lib/engine/config";
import type { Cycle } from "@/lib/engine/cycle";
import { computeMonthlyCorrectedDemand, monthsThroughCutoff } from "@/lib/engine/demand";
import { computeForecast } from "@/lib/engine/forecast";
import { imputeStockoutDemand } from "@/lib/engine/imputation";
import { monthKey, monthRange } from "@/lib/engine/months";
import { closingStockByMonth, computeAvgMonthlyNetSales } from "@/lib/engine/stockflow";
import { groupTransitArrivals, isInTransitAtCutoff, projectStock } from "@/lib/engine/stockprojection";
import type {
  EngineFactoryOrder,
  EngineInventoryRow,
  EngineLead,
  EngineSale,
} from "@/lib/engine/inputs";

export type SafetyTier = "high" | "mid" | "low";

export interface ModelEconomics {
  unitCost: number;
  marginPct: number;
  monthlyFinCost: number; // USD por unidad por mes
}

export interface ModelOrderPlan {
  modelName: string;
  forecastMonthlyRate: number;
  monthlyStdDev: number;
  hasSeasonalIndex: boolean;
  forecastByMonth: Record<string, number>; // "YYYY-MM" -> unidades pronosticadas (meses hasta la llegada y ventana de cobertura)
  arrivalMonth: string; // mes en que llega este pedido
  gapMonths: string[]; // meses entre el corte y la llegada del pedido
  coverageMonths: string[];
  demandGap: number;
  demandCoverageWindow: number;
  patioAtCutoff: number;
  transitoAtCutoff: number;
  projectedStockAtArrival: number;
  unmetDemandGap: number; // demanda hasta la llegada que no se puede atender (se pierde, no se arrastra al pedido)
  imputedStockoutMonths: number; // meses de quiebre cuya demanda se imputó al promedio sin quiebre
  safetyTier: SafetyTier;
  safetyStockUnits: number;
  need: number;
  orderUnits: number;
  capital: number;
  monthlyFinCostEstimate: number;
  coverageMonthsAchieved: number;
  flags: string[];
}

/** Sube `units` al múltiplo de lote más cercano hacia arriba. */
export function roundToLot(units: number, lotMultiple: number): number {
  if (units <= 0) return 0;
  return Math.ceil(units / lotMultiple) * lotMultiple;
}

/**
 * Pedido final para un modelo, cumpliendo "0 o >= mínimo y múltiplo del
 * lote": si la necesidad es <= 0 o por debajo de `thresholdPct` del
 * mínimo, el pedido es 0; en otro caso se sube al mínimo y se redondea.
 */
export function computeOrderUnits(need: number, model: ModelConfig, thresholdPct: number): number {
  if (need <= 0) return 0;
  if (need < model.lot_min * thresholdPct) return 0;
  return roundToLot(Math.max(need, model.lot_min), model.lot_multiple);
}

/** Clasifica el modelo en un nivel de colchón según margen y costo financiero. */
export function classifySafetyTier(
  economics: ModelEconomics,
  safetyConfig: CycleConfig["safety_stock"],
): SafetyTier {
  if (economics.monthlyFinCost > safetyConfig.high_fin_cost_monthly_threshold) return "low";
  if (economics.marginPct >= safetyConfig.margin_high_threshold_pct) return "high";
  if (economics.marginPct <= safetyConfig.margin_low_threshold_pct) return "low";
  return "mid";
}

function safetyZ(tier: SafetyTier, safetyConfig: CycleConfig["safety_stock"]): number {
  if (tier === "high") return safetyConfig.z_high_margin;
  if (tier === "mid") return safetyConfig.z_mid_margin;
  return safetyConfig.z_low_margin_or_high_fin_cost;
}

/** Unidades en patio y en tránsito del modelo al corte, para proyectar el stock al mes de llegada. */
export function computePatioAndTransito(params: {
  modelName: string;
  inventory: EngineInventoryRow[];
  factoryOrders: EngineFactoryOrder[];
  cutoffDate: string;
}): { patio: number; transito: number } {
  const { modelName, inventory, factoryOrders, cutoffDate } = params;
  const cutoffMonth = monthKey(cutoffDate);

  let patio = 0;
  for (const row of inventory) {
    if (row.modelName === modelName && monthKey(row.monthEnd) === cutoffMonth) patio += row.units;
  }

  let transito = 0;
  for (const order of factoryOrders) {
    if (isInTransitAtCutoff(order, modelName, cutoffDate)) transito += order.units;
  }

  return { patio, transito };
}

function sumForecast(forecastByMonth: Record<string, number>, months: string[]): number {
  return months.reduce((acc, m) => acc + (forecastByMonth[m] ?? 0), 0);
}

/**
 * Calcula el pedido sugerido de un modelo para el ciclo vigente,
 * encadenando demand -> forecast -> proyección de stock -> necesidad
 * -> colchón de seguridad -> redondeo a lote.
 */
export function computeModelOrderPlan(params: {
  config: CycleConfig;
  cycle: Cycle;
  model: ModelConfig;
  economics: ModelEconomics;
  sales: EngineSale[];
  leads: EngineLead[];
  inventory: EngineInventoryRow[];
  factoryOrders: EngineFactoryOrder[];
}): ModelOrderPlan {
  const { config, cycle, model, economics, sales, leads, inventory, factoryOrders } = params;

  const gapMonths = cycle.gapMonths;
  const coverageMonths =
    model.horizon_months === undefined ? cycle.coverageMonths : monthRange(cycle.arrivalMonth, model.horizon_months);
  const coverageMonthsCount = coverageMonths.length;

  const rawHistory = computeMonthlyCorrectedDemand(
    model.name,
    sales,
    leads,
    monthsThroughCutoff(sales, monthKey(cycle.cutoffDate)),
  );
  const { history, imputedMonths } = imputeStockoutDemand({
    history: rawHistory,
    closingStockByMonth: closingStockByMonth(model.name, inventory),
    avgMonthlyNetSales: computeAvgMonthlyNetSales(model.name, sales),
    minStockFraction: config.stockout_min_stock_fraction,
  });
  const forecast = computeForecast({
    history,
    targetMonths: [...gapMonths, ...coverageMonths],
    weights: config.forecast_weights,
    minYearsForSeasonality: config.seasonality_min_years,
  });

  const demandGap = sumForecast(forecast.forecastByMonth, gapMonths);
  const demandCoverageWindow = sumForecast(forecast.forecastByMonth, coverageMonths);

  const { patio, transito } = computePatioAndTransito({
    modelName: model.name,
    inventory,
    factoryOrders,
    cutoffDate: cycle.cutoffDate,
  });
  const transitArrivals = groupTransitArrivals({
    modelName: model.name,
    factoryOrders,
    cutoffDate: cycle.cutoffDate,
    months: gapMonths,
  });
  const { stockEnd: projectedStockAtArrival, unmetDemand: unmetDemandGap } = projectStock({
    startingStock: patio,
    months: gapMonths,
    arrivalsByMonth: transitArrivals.byMonth,
    arrivalsAfterPeriod: transitArrivals.afterPeriod,
    forecastByMonth: forecast.forecastByMonth,
  });

  const safetyTier = classifySafetyTier(economics, config.safety_stock);
  const safetyStockUnits =
    model.safety_stock_override !== undefined
      ? model.safety_stock_override
      : safetyZ(safetyTier, config.safety_stock) * forecast.monthlyStdDev * Math.sqrt(coverageMonthsCount);

  const need = demandCoverageWindow + safetyStockUnits - projectedStockAtArrival;
  const orderUnits = computeOrderUnits(need, model, config.min_order_effective_threshold_pct);

  const capital = orderUnits * economics.unitCost;
  const monthlyFinCostEstimate = orderUnits * economics.monthlyFinCost;
  const coverageMonthsAchieved = forecast.baseMonthlyRate > 0 ? orderUnits / forecast.baseMonthlyRate : 0;

  const flags: string[] = [];
  if (forecast.seasonalIndex === null) {
    flags.push("sin_historia_suficiente_para_estacionalidad");
  }
  if (model.lifecycle === "last_window") flags.push("ultima_ventana_de_generacion");
  if (imputedMonths.length > 0) flags.push("demanda_imputada_por_quiebre");
  if (need > 0 && need < model.lot_min * config.min_order_effective_threshold_pct) {
    flags.push("necesidad_bajo_minimo_efectivo_pedido_cero");
  }
  if (need <= 0) flags.push("sin_necesidad_pedido_cero");

  return {
    modelName: model.name,
    forecastMonthlyRate: forecast.baseMonthlyRate,
    monthlyStdDev: forecast.monthlyStdDev,
    hasSeasonalIndex: forecast.seasonalIndex !== null,
    forecastByMonth: forecast.forecastByMonth,
    arrivalMonth: cycle.arrivalMonth,
    gapMonths,
    coverageMonths,
    demandGap,
    demandCoverageWindow,
    patioAtCutoff: patio,
    transitoAtCutoff: transito,
    projectedStockAtArrival,
    unmetDemandGap,
    imputedStockoutMonths: imputedMonths.length,
    safetyTier,
    safetyStockUnits,
    need,
    orderUnits,
    capital,
    monthlyFinCostEstimate,
    coverageMonthsAchieved,
    flags,
  };
}
