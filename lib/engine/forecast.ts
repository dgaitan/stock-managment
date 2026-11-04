// Puro, sin Next/React/DB. Pronóstico mensual por modelo: promedio
// ponderado de la demanda corregida (últimos 6 meses peso 0.6, meses
// 7-12 peso 0.4) con índice estacional por mes cuando hay suficientes
// años de historia para sostenerlo. Ver docs/PLAN.md "Lógica del motor
// de pedido", paso 5, y "Supuestos".

import { compareMonthKeys } from "@/lib/engine/months";
import type { MonthlyDemandPoint } from "@/lib/engine/demand";

export interface ForecastWeights {
  recent_6m: number;
  prior_6m: number;
}

export interface ForecastResult {
  baseMonthlyRate: number;
  monthlyStdDev: number;
  seasonalIndex: Record<string, number> | null; // "01".."12" -> índice, null si no hay suficiente historia
  forecastByMonth: Record<string, number>; // "YYYY-MM" -> unidades pronosticadas
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Tasa mensual base: 0.6 sobre el promedio de los últimos 6 meses, 0.4 sobre los 6 anteriores. */
export function computeBaseMonthlyRate(
  historyAsc: MonthlyDemandPoint[],
  weights: ForecastWeights,
): number {
  const recent = historyAsc.slice(-6);
  const prior = historyAsc.slice(-12, -6);
  const recentAvg = average(recent.map((p) => p.correctedDemand));
  const priorAvg = prior.length > 0 ? average(prior.map((p) => p.correctedDemand)) : recentAvg;
  return recentAvg * weights.recent_6m + priorAvg * weights.prior_6m;
}

/** Desviación estándar poblacional de una serie de valores mensuales. */
export function computeMonthlyStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

/**
 * Índice estacional por mes calendario (01..12), relativo al promedio
 * general de la serie. Devuelve null si la historia no cubre al menos
 * `minYears` años distintos (no hay base para sostener un patrón
 * estacional).
 */
export function computeSeasonalIndex(
  historyAsc: MonthlyDemandPoint[],
  minYears: number,
): Record<string, number> | null {
  if (historyAsc.length === 0) return null;

  const years = new Set(historyAsc.map((p) => Number(p.month.slice(0, 4))));
  if (years.size < minYears) return null;

  const overallAvg = average(historyAsc.map((p) => p.correctedDemand));
  if (overallAvg === 0) return null;

  const byCalendarMonth = new Map<string, number[]>();
  for (const point of historyAsc) {
    const mm = point.month.slice(5, 7);
    const list = byCalendarMonth.get(mm) ?? [];
    list.push(point.correctedDemand);
    byCalendarMonth.set(mm, list);
  }

  const index: Record<string, number> = {};
  for (const [mm, values] of byCalendarMonth) {
    index[mm] = average(values) / overallAvg;
  }
  return index;
}

/**
 * Pronostica `targetMonths` a partir de la historia de demanda
 * corregida de un modelo. La tasa base y la desviación usan los
 * últimos 12 meses disponibles; el índice estacional usa toda la
 * historia si alcanza `minYearsForSeasonality` años.
 */
export function computeForecast(params: {
  history: MonthlyDemandPoint[];
  targetMonths: string[];
  weights: ForecastWeights;
  minYearsForSeasonality: number;
}): ForecastResult {
  const { targetMonths, weights, minYearsForSeasonality } = params;
  const historyAsc = [...params.history].sort((a, b) => compareMonthKeys(a.month, b.month));

  const baseMonthlyRate = computeBaseMonthlyRate(historyAsc, weights);
  const monthlyStdDev = computeMonthlyStdDev(historyAsc.slice(-12).map((p) => p.correctedDemand));
  const seasonalIndex = computeSeasonalIndex(historyAsc, minYearsForSeasonality);

  const forecastByMonth: Record<string, number> = {};
  for (const month of targetMonths) {
    const mm = month.slice(5, 7);
    const index = seasonalIndex?.[mm] ?? 1;
    forecastByMonth[month] = Math.max(0, baseMonthlyRate * index);
  }

  return { baseMonthlyRate, monthlyStdDev, seasonalIndex, forecastByMonth };
}
