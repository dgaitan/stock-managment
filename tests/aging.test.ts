import { describe, expect, it } from "vitest";
import { agingThresholdDays, summarizeStockAging } from "@/lib/engine/aging";

const row = (units: number, avgAgeDays: number | null, monthEnd = "2026-09-30") => ({
  monthEnd,
  modelName: "Hilux",
  units,
  avgAgeDays,
});

describe("agingThresholdDays", () => {
  it("usa el primer escalón de descuento", () => {
    expect(agingThresholdDays({ "270": 0.07, "180": 0.04, "365": 0.1 })).toBe(180);
    expect(agingThresholdDays({})).toBeNull();
  });
});

describe("summarizeStockAging", () => {
  it("cuenta unidades en filas con antigüedad >= umbral y promedia por unidades", () => {
    const result = summarizeStockAging({
      modelName: "Hilux",
      inventory: [row(34, 200), row(100, 60), row(50, 400, "2026-08-31")],
      cutoffDate: "2026-09-30",
      thresholdDays: 180,
    });
    expect(result.agedUnits).toBe(34);
    expect(result.avgAgeDays).toBe(Math.round((34 * 200 + 100 * 60) / 134));
  });

  it("sin antigüedad conocida no inventa un promedio", () => {
    const result = summarizeStockAging({
      modelName: "Hilux",
      inventory: [row(10, null)],
      cutoffDate: "2026-09-30",
      thresholdDays: 180,
    });
    expect(result).toEqual({ agedUnits: 0, avgAgeDays: null, thresholdDays: 180 });
  });
});
