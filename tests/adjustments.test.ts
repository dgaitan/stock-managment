import { describe, expect, it } from "vitest";
import { applyDemandFactors, describeFactor, NO_ADJUSTMENTS } from "@/lib/engine/adjustments";
import type { CycleConfig, ModelConfig } from "@/lib/engine/config";
import { deriveCycle } from "@/lib/engine/cycle";
import { explainOrder } from "@/lib/engine/explain";
import { computeModelOrderPlan } from "@/lib/engine/order";
import type { NormalizedSale } from "@/lib/sources/types";

describe("applyDemandFactors", () => {
  const forecast = { "2027-01": 10, "2027-02": 10, "2027-03": 10 };

  it("multiplica solo los meses indicados y solo del modelo indicado", () => {
    const result = applyDemandFactors(forecast, "Hilux", [
      { model: "Hilux", factor: 1.5, months: ["2027-02"] },
      { model: "Yaris", factor: 3 },
    ]);
    expect(result).toEqual({ "2027-01": 10, "2027-02": 15, "2027-03": 10 });
  });

  it("sin meses aplica a todos y los factores se componen", () => {
    const result = applyDemandFactors(forecast, "Hilux", [
      { model: "Hilux", factor: 2 },
      { model: "Hilux", factor: 0.5, months: ["2027-03"] },
    ]);
    expect(result).toEqual({ "2027-01": 20, "2027-02": 20, "2027-03": 10 });
  });

  it("sin factores del modelo devuelve el mismo pronóstico y no muta la entrada", () => {
    expect(applyDemandFactors(forecast, "Hilux", [])).toBe(forecast);
    applyDemandFactors(forecast, "Hilux", [{ model: "Hilux", factor: 2 }]);
    expect(forecast["2027-01"]).toBe(10);
  });
});

describe("describeFactor", () => {
  it("lista los meses cuando los hay y los omite cuando aplica a todos", () => {
    expect(describeFactor({ model: "Hilux", factor: 1.2, months: ["2027-02", "2027-03"] })).toBe(
      "Hilux: demanda ×1.2 en 2027-02, 2027-03",
    );
    expect(describeFactor({ model: "Rush", factor: 0.8 })).toBe("Rush: demanda ×0.8");
  });
});

describe("computeModelOrderPlan con consideraciones", () => {
  const model: ModelConfig = { name: "Hilux", lot_min: 12, lot_multiple: 6 };
  const cycle = deriveCycle({ cutoffDate: "2026-09-30", leadTimeMonths: 4, windowMonths: [1, 4, 7, 10] });
  const config: CycleConfig = {
    lead_time_months: 4,
    window_months: [1, 4, 7, 10],
    fleet_outlier_min_units: 10,
    min_order_effective_threshold_pct: 0.5,
    stockout_min_stock_fraction: 0.5,
    version_mix_window_months: 12,
    forecast_weights: { recent_6m: 0.6, prior_6m: 0.4 },
    seasonality_min_years: 2,
    min_history_months: 24,
    safety_stock: {
      z_high_margin: 1.65,
      z_mid_margin: 1.28,
      z_low_margin_or_high_fin_cost: 0.84,
      margin_high_threshold_pct: 0.12,
      margin_low_threshold_pct: 0.09,
      high_fin_cost_monthly_threshold: 400,
    },
    plan_piso_monthly_pct: 0.009,
    aging_discounts: { "180": 0.04, "270": 0.07, "365": 0.1 },
    loss_reason_categories: ["stock", "price", "financing", "competitor", "postponed", "no_followup"],
    backtest_cutoffs: [],
  };
  const sales: NormalizedSale[] = ["2025-10", "2025-12", "2026-02", "2026-04", "2026-06", "2026-08"].map((m) => ({
    invoice: `F-${m}`,
    businessKey: `bk-${m}`,
    lineHash: m,
    date: `${m}-15`,
    branchNameRaw: null,
    branchName: null,
    seller: null,
    customerType: "Individual",
    customer: null,
    modelNameRaw: "Hilux",
    modelName: "Hilux",
    version: null,
    color: null,
    units: 20,
    unitPrice: null,
    note: null,
    isCreditNote: false,
    isFleetOutlier: false,
  }));
  const run = (adjustments = NO_ADJUSTMENTS) =>
    computeModelOrderPlan({
      config,
      cycle,
      model,
      economics: { unitCost: 38000, marginPct: 0.13, monthlyFinCost: 340 },
      sales,
      leads: [],
      inventory: [],
      factoryOrders: [],
      adjustments,
    });

  it("sin consideraciones no hay marcas de ajuste", () => {
    expect(run().flags).not.toContain("demanda_ajustada_por_usuario");
    expect(run().flags).not.toContain("excluido_por_usuario");
  });

  it("demanda ×2 en la ventana de cobertura duplica esa demanda y sube el pedido", () => {
    const base = run();
    const adjusted = run({
      demandFactors: [{ model: "Hilux", factor: 2, months: base.coverageMonths }],
      excludedModels: [],
    });
    expect(adjusted.demandCoverageWindow).toBeCloseTo(base.demandCoverageWindow * 2, 6);
    expect(adjusted.demandGap).toBeCloseTo(base.demandGap, 6);
    expect(adjusted.orderUnits).toBeGreaterThan(base.orderUnits);
    expect(adjusted.flags).toContain("demanda_ajustada_por_usuario");
  });

  it("un modelo excluido pide 0 aunque tenga necesidad, y el texto lo dice", () => {
    const plan = run({ demandFactors: [], excludedModels: ["Hilux"] });
    expect(run().orderUnits).toBeGreaterThan(0);
    expect(plan.orderUnits).toBe(0);
    expect(plan.capital).toBe(0);
    expect(plan.flags).toContain("excluido_por_usuario");
    expect(plan.flags).not.toContain("sin_necesidad_pedido_cero");
    expect(explainOrder(plan)).toContain("excluyó");
  });

  it("excluir otro modelo no afecta a este", () => {
    expect(run({ demandFactors: [], excludedModels: ["Yaris"] }).orderUnits).toBe(run().orderUnits);
  });
});
