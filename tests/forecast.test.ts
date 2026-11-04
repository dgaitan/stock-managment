import { describe, expect, it } from "vitest";
import {
  computeBaseMonthlyRate,
  computeForecast,
  computeMonthlyStdDev,
  computeSeasonalIndex,
} from "@/lib/engine/forecast";
import type { MonthlyDemandPoint } from "@/lib/engine/demand";

const WEIGHTS = { recent_6m: 0.6, prior_6m: 0.4 };

function point(month: string, correctedDemand: number): MonthlyDemandPoint {
  return { month, baseSales: correctedDemand, lostStockRecovered: 0, substitutionRemoved: 0, correctedDemand };
}

function monthStr(n: number): string {
  return `2026-${String(n).padStart(2, "0")}`;
}

describe("computeBaseMonthlyRate", () => {
  it("pondera 0.6 los ultimos 6 meses y 0.4 los 6 anteriores", () => {
    const history = [
      ...Array.from({ length: 6 }, (_, i) => point(monthStr(i + 1), 10)), // meses 7-12 (prior)
      ...Array.from({ length: 6 }, (_, i) => point(monthStr(i + 7), 20)), // ultimos 6 (recent)
    ];
    expect(computeBaseMonthlyRate(history, WEIGHTS)).toBeCloseTo(20 * 0.6 + 10 * 0.4);
  });

  it("usa el promedio reciente como referencia si no hay 6 meses previos", () => {
    const history = [point("2026-01", 10), point("2026-02", 30)];
    expect(computeBaseMonthlyRate(history, WEIGHTS)).toBeCloseTo(20); // promedio 20, sin prior distinto
  });
});

describe("computeMonthlyStdDev", () => {
  it("calcula la desviacion poblacional", () => {
    expect(computeMonthlyStdDev([10, 10, 10])).toBe(0);
    expect(computeMonthlyStdDev([])).toBe(0);
    expect(computeMonthlyStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 0);
  });
});

describe("computeSeasonalIndex", () => {
  it("devuelve null si no hay suficientes anios distintos", () => {
    const history = [point("2026-01", 10), point("2026-02", 20)];
    expect(computeSeasonalIndex(history, 2)).toBeNull();
  });

  it("calcula el indice relativo al promedio general con suficiente historia", () => {
    const history = [
      point("2024-01", 20),
      point("2024-06", 10),
      point("2025-01", 20),
      point("2025-06", 10),
    ];
    // promedio general = 15; enero promedia 20 (indice 1.33), junio promedia 10 (indice 0.67)
    const index = computeSeasonalIndex(history, 2);
    expect(index?.["01"]).toBeCloseTo(20 / 15);
    expect(index?.["06"]).toBeCloseTo(10 / 15);
  });
});

describe("computeForecast", () => {
  it("aplica el indice estacional al pronosticar meses futuros", () => {
    const history = [
      point("2024-01", 20),
      point("2024-06", 10),
      point("2025-01", 20),
      point("2025-06", 10),
    ];
    const result = computeForecast({
      history,
      targetMonths: ["2027-01", "2027-06"],
      weights: WEIGHTS,
      minYearsForSeasonality: 2,
    });
    expect(result.seasonalIndex).not.toBeNull();
    expect(result.forecastByMonth["2027-01"]).toBeGreaterThan(result.forecastByMonth["2027-06"]);
  });

  it("pronostica plano (sin estacionalidad) cuando no hay suficiente historia", () => {
    const history = [point("2026-01", 10), point("2026-02", 10)];
    const result = computeForecast({
      history,
      targetMonths: ["2027-02", "2027-03"],
      weights: WEIGHTS,
      minYearsForSeasonality: 2,
    });
    expect(result.seasonalIndex).toBeNull();
    expect(result.forecastByMonth["2027-02"]).toBe(result.forecastByMonth["2027-03"]);
  });
});
