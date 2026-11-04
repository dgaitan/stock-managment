import { describe, expect, it } from "vitest";
import { explainOrder, formatMonthRangeLabel } from "@/lib/engine/explain";
import type { ModelOrderPlan } from "@/lib/engine/order";

function basePlan(partial: Partial<ModelOrderPlan>): ModelOrderPlan {
  return {
    modelName: "Hilux",
    forecastMonthlyRate: 15,
    monthlyStdDev: 3,
    hasSeasonalIndex: true,
    forecastByMonth: {},
    arrivalMonth: "2027-02",
    gapMonths: ["2026-10", "2026-11", "2026-12", "2027-01"],
    coverageMonths: ["2027-02", "2027-03", "2027-04"],
    demandGap: 60,
    demandCoverageWindow: 45,
    patioAtCutoff: 135,
    transitoAtCutoff: 103,
    projectedStockAtArrival: 178,
    unmetDemandGap: 0,
    imputedStockoutMonths: 0,
    safetyTier: "high",
    safetyStockUnits: 8,
    need: -125,
    orderUnits: 0,
    capital: 0,
    monthlyFinCostEstimate: 0,
    coverageMonthsAchieved: 0,
    flags: ["sin_necesidad_pedido_cero"],
    ...partial,
  };
}

describe("formatMonthRangeLabel", () => {
  it("formatea un rango de meses en español", () => {
    expect(formatMonthRangeLabel(["2027-02", "2027-03", "2027-04"])).toBe("feb-abr 2027");
  });
  it("formatea un solo mes sin guion", () => {
    expect(formatMonthRangeLabel(["2027-02"])).toBe("feb 2027");
  });
  it("devuelve vacio si no hay meses", () => {
    expect(formatMonthRangeLabel([])).toBe("");
  });
});

describe("explainOrder", () => {
  it("incluye la tasa de demanda, el stock proyectado y el motivo del pedido 0", () => {
    const text = explainOrder(basePlan({}));
    expect(text).toContain("15 u/mes");
    expect(text).toContain("178");
    expect(text).toContain("pedido sugerido es 0 unidades");
  });

  it("avisa que la demanda sin stock se pierde y no se suma al pedido", () => {
    const text = explainOrder(basePlan({ projectedStockAtArrival: 0, unmetDemandGap: 64.7 }));
    expect(text).toContain("64.7");
    expect(text).toContain("ventas perdidas");
  });

  it("avisa cuántos meses de quiebre se imputaron", () => {
    const text = explainOrder(basePlan({ imputedStockoutMonths: 9 }));
    expect(text).toContain("9 meses");
    expect(text).toContain("quiebre");
  });

  it("usa el singular cuando se imputó un solo mes", () => {
    expect(explainOrder(basePlan({ imputedStockoutMonths: 1 }))).toContain("1 mes de la historia");
  });

  it("no menciona imputación cuando no hubo quiebres", () => {
    expect(explainOrder(basePlan({}))).not.toContain("quiebre");
  });

  it("no menciona ventas perdidas cuando todo se atiende", () => {
    expect(explainOrder(basePlan({}))).not.toContain("ventas perdidas");
  });

  it("incluye unidades, capital y costo financiero cuando el pedido es > 0", () => {
    const plan = basePlan({ need: 30, orderUnits: 36, capital: 1368000, monthlyFinCostEstimate: 12240, flags: [] });
    const text = explainOrder(plan);
    expect(text).toContain("36 unidades");
    expect(text).toContain("capital");
    expect(text).toContain("costo financiero");
  });

  it("traduce las alertas a texto legible", () => {
    const plan = basePlan({ flags: ["ultima_ventana_de_generacion"] });
    const text = explainOrder(plan);
    expect(text).toContain("última ventana de esta generación");
  });

  it("avisa cuando no hay indice estacional", () => {
    const plan = basePlan({ hasSeasonalIndex: false });
    expect(explainOrder(plan)).toContain("sin ajuste estacional");
  });
});
