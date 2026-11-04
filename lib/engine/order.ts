// Puro, sin Next/React/DB. Orquesta demand + forecast para calcular el
// pedido por modelo: proyecta el stock a febrero, calcula la necesidad
// para la ventana de cobertura, aplica el colchón de seguridad y
// redondea al mínimo/múltiplo de lote. Ver docs/PLAN.md "Lógica del
// motor de pedido", pasos 6-8.

import type { CycleConfig, ModelConfig } from "@/lib/engine/config";
import { computeMonthlyCorrectedDemand, monthsThroughCutoff } from "@/lib/engine/demand";
import { computeForecast } from "@/lib/engine/forecast";
import { imputeStockoutDemand } from "@/lib/engine/imputation";
import { addMonths, monthKey, monthRange } from "@/lib/engine/months";
import { closingStockByMonth, computeAvgMonthlyNetSales } from "@/lib/engine/stockflow";
import { groupTransitArrivals, isInTransitAtCutoff, projectStock } from "@/lib/engine/stockprojection";
import type {
  NormalizedFactoryOrder,
  NormalizedInventorySnapshot,
  NormalizedLead,
  NormalizedSale,
} from "@/lib/sources/types";

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
  octEneMonths: string[];
  coverageMonths: string[];
  demandOctEne: number;
  demandCoverageWindow: number;
  patioAtCutoff: number;
  transitoAtCutoff: number;
  projectedStockFeb: number;
  unmetDemandOctEne: number; // demanda oct-ene que no se puede atender (se pierde, no se arrastra al pedido)
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

/** Unidades en patio y en tránsito del modelo al corte, para proyectar el stock a febrero. */
export function computePatioAndTransito(params: {
  modelName: string;
  inventory: NormalizedInventorySnapshot[];
  factoryOrders: NormalizedFactoryOrder[];
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
  model: ModelConfig;
  economics: ModelEconomics;
  sales: NormalizedSale[];
  leads: NormalizedLead[];
  inventory: NormalizedInventorySnapshot[];
  factoryOrders: NormalizedFactoryOrder[];
}): ModelOrderPlan {
  const { config, model, economics, sales, leads, inventory, factoryOrders } = params;

  const cutoffMonth = monthKey(config.cutoff_date);
  const octEneMonths = monthRange(addMonths(cutoffMonth, 1), config.lead_time_months);
  const febStart = addMonths(cutoffMonth, 1 + config.lead_time_months);
  const coverageMonthsCount = model.horizon_months ?? config.order_coverage_months;
  const coverageMonths = monthRange(febStart, coverageMonthsCount);

  const rawHistory = computeMonthlyCorrectedDemand(
    model.name,
    sales,
    leads,
    monthsThroughCutoff(sales, cutoffMonth),
  );
  const { history, imputedMonths } = imputeStockoutDemand({
    history: rawHistory,
    closingStockByMonth: closingStockByMonth(model.name, inventory),
    avgMonthlyNetSales: computeAvgMonthlyNetSales(model.name, sales),
    minStockFraction: config.stockout_min_stock_fraction,
  });
  const forecast = computeForecast({
    history,
    targetMonths: [...octEneMonths, ...coverageMonths],
    weights: config.forecast_weights,
    minYearsForSeasonality: config.seasonality_min_years,
  });

  const demandOctEne = sumForecast(forecast.forecastByMonth, octEneMonths);
  const demandCoverageWindow = sumForecast(forecast.forecastByMonth, coverageMonths);

  const { patio, transito } = computePatioAndTransito({
    modelName: model.name,
    inventory,
    factoryOrders,
    cutoffDate: config.cutoff_date,
  });
  const transitArrivals = groupTransitArrivals({
    modelName: model.name,
    factoryOrders,
    cutoffDate: config.cutoff_date,
    months: octEneMonths,
  });
  const { stockEnd: projectedStockFeb, unmetDemand: unmetDemandOctEne } = projectStock({
    startingStock: patio,
    months: octEneMonths,
    arrivalsByMonth: transitArrivals.byMonth,
    arrivalsAfterPeriod: transitArrivals.afterPeriod,
    forecastByMonth: forecast.forecastByMonth,
  });

  const safetyTier = classifySafetyTier(economics, config.safety_stock);
  const safetyStockUnits =
    model.safety_stock_override !== undefined
      ? model.safety_stock_override
      : safetyZ(safetyTier, config.safety_stock) * forecast.monthlyStdDev * Math.sqrt(coverageMonthsCount);

  const need = demandCoverageWindow + safetyStockUnits - projectedStockFeb;
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
    octEneMonths,
    coverageMonths,
    demandOctEne,
    demandCoverageWindow,
    patioAtCutoff: patio,
    transitoAtCutoff: transito,
    projectedStockFeb,
    unmetDemandOctEne,
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
