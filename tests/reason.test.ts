import { describe, expect, it } from "vitest";
import type { StockAging } from "@/lib/engine/aging";
import type { ModelOrderPlan } from "@/lib/engine/order";
import { summarizeReason } from "@/lib/engine/reason";

const plan = (partial: Partial<ModelOrderPlan>): ModelOrderPlan =>
  ({
    modelName: "Hilux",
    arrivalMonth: "2027-02",
    coverageMonths: ["2027-02", "2027-03", "2027-04"],
    projectedStockAtArrival: 89.4,
    imputedStockoutMonths: 0,
    orderUnits: 48,
    flags: [],
    ...partial,
  }) as ModelOrderPlan;
const aging = (agedUnits: number): StockAging => ({ agedUnits, avgAgeDays: 100, thresholdDays: 180 });

describe("summarizeReason", () => {
  it("marca quiebre cuando no hay patio y hubo meses imputados", () => {
    const r = summarizeReason(
      plan({ imputedStockoutMonths: 6, patioAtCutoff: 0, projectedStockAtArrival: 0 }),
      aging(0),
    );
    expect(r).toEqual({ badge: "quiebre", text: "Sin unidades en patio; demanda oculta en 6 meses de quiebre" });
  });
  it("con patio, los meses de quiebre no son una excepción de la tabla", () => {
    const r = summarizeReason(plan({ imputedStockoutMonths: 1, patioAtCutoff: 20 }), aging(0));
    expect(r.badge).toBeNull();
  });
  it("marca antigüedad con las unidades viejas y el umbral", () => {
    expect(summarizeReason(plan({}), aging(34))).toEqual({
      badge: "antiguedad",
      text: "Stock a feb: 89 u.; 34 u. con más de 180 días",
    });
  });
  it("marca fin de generación solo si no se pide nada", () => {
    const flags = ["ultima_ventana_de_generacion"];
    expect(summarizeReason(plan({ flags, orderUnits: 0 }), aging(0))).toEqual({
      badge: "fin_generacion",
      text: "El tránsito cubre hasta abr-2027",
    });
    expect(summarizeReason(plan({ flags, orderUnits: 8 }), aging(0)).badge).toBeNull();
  });
  it("avisa cuando se pide el mínimo del lote", () => {
    const r = summarizeReason(plan({ flags: ["pedido_minimo_del_lote"] }), aging(0));
    expect(r).toEqual({ badge: null, text: "Stock a feb: 89 u.; se pide el mínimo del lote" });
  });
});
