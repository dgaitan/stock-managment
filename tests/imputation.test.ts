import { describe, expect, it } from "vitest";
import { imputeStockoutDemand } from "@/lib/engine/imputation";
import { monthsThroughCutoff } from "@/lib/engine/demand";
import type { MonthlyDemandPoint } from "@/lib/engine/demand";
import type { NormalizedSale } from "@/lib/sources/types";

function point(month: string, correctedDemand: number): MonthlyDemandPoint {
  return {
    month,
    baseSales: correctedDemand,
    lostStockRecovered: 0,
    substitutionRecovered: 0,
    substitutionRemoved: 0,
    correctedDemand,
  };
}

const HISTORY = [point("2026-01", 30), point("2026-02", 30), point("2026-03", 6), point("2026-04", 0)];

describe("imputeStockoutDemand", () => {
  it("sube la demanda de los meses de quiebre al promedio de los meses sin quiebre", () => {
    const closing = new Map([
      ["2026-01", 40],
      ["2026-02", 35],
      ["2026-03", 2], // < 50% de 20 u/mes (venta promedio) -> quiebre
      // abril sin snapshot -> stock 0 -> quiebre
    ]);
    const result = imputeStockoutDemand({
      history: HISTORY,
      closingStockByMonth: closing,
      avgMonthlyNetSales: 20,
      minStockFraction: 0.5,
    });
    expect(result.baselineDemand).toBe(30);
    expect(result.imputedMonths).toEqual(["2026-03", "2026-04"]);
    expect(result.history.map((p) => p.correctedDemand)).toEqual([30, 30, 30, 30]);
  });

  it("nunca baja la demanda de un mes de quiebre que ya supera el promedio", () => {
    const history = [point("2026-01", 10), point("2026-02", 50)];
    const result = imputeStockoutDemand({
      history,
      closingStockByMonth: new Map([["2026-01", 30]]), // febrero sin snapshot -> quiebre
      avgMonthlyNetSales: 20,
      minStockFraction: 0.5,
    });
    expect(result.history[1].correctedDemand).toBe(50);
    expect(result.imputedMonths).toEqual([]);
  });

  it("no imputa si todos los meses son de quiebre (no hay base)", () => {
    const result = imputeStockoutDemand({
      history: HISTORY,
      closingStockByMonth: new Map(),
      avgMonthlyNetSales: 20,
      minStockFraction: 0.5,
    });
    expect(result.imputedMonths).toEqual([]);
    expect(result.history).toEqual(HISTORY);
  });

  it("no cambia nada si ningún mes fue de quiebre", () => {
    const closing = new Map(HISTORY.map((p) => [p.month, 50]));
    const result = imputeStockoutDemand({
      history: HISTORY,
      closingStockByMonth: closing,
      avgMonthlyNetSales: 20,
      minStockFraction: 0.5,
    });
    expect(result.imputedMonths).toEqual([]);
    expect(result.history).toEqual(HISTORY);
  });
});

describe("monthsThroughCutoff", () => {
  const sale = (date: string): NormalizedSale =>
    ({ date, modelName: "Hilux", units: 1 }) as NormalizedSale;

  it("lista todos los meses desde la primera venta hasta el corte, incluidos los sin ventas", () => {
    const months = monthsThroughCutoff([sale("2026-01-10"), sale("2026-04-02")], "2026-05");
    expect(months).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]);
  });

  it("devuelve vacío si no hay ventas hasta el corte", () => {
    expect(monthsThroughCutoff([sale("2026-06-01")], "2026-05")).toEqual([]);
  });
});
