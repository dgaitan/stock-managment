// Puro, sin Next/React/DB. Consideraciones del planificador que el motor sabe
// aplicar: multiplicar la demanda pronosticada de un modelo en ciertos meses y
// excluir un modelo del pedido. Son parámetros acotados; la IA los propone
// (lib/ai/rules.ts) pero nunca escribe cantidades. Lo que no cabe aquí se
// marca «no aplicada» antes de llegar al motor.

export const MIN_DEMAND_FACTOR = 0.1;
export const MAX_DEMAND_FACTOR = 3;

export interface DemandFactor {
  model: string;
  factor: number; // 1.2 = +20 %
  months?: string[]; // "YYYY-MM"; sin meses = todos los del pronóstico
}

export interface OrderAdjustments {
  demandFactors: DemandFactor[];
  excludedModels: string[];
}

export const NO_ADJUSTMENTS: OrderAdjustments = { demandFactors: [], excludedModels: [] };

/** Devuelve el pronóstico mensual con los factores del modelo aplicados (no muta la entrada). */
export function applyDemandFactors(
  forecastByMonth: Record<string, number>,
  modelName: string,
  factors: DemandFactor[],
): Record<string, number> {
  const mine = factors.filter((f) => f.model === modelName);
  if (mine.length === 0) return forecastByMonth;
  const adjusted: Record<string, number> = {};
  for (const [month, units] of Object.entries(forecastByMonth)) {
    adjusted[month] = mine.reduce(
      (acc, f) => (f.months === undefined || f.months.includes(month) ? acc * f.factor : acc),
      units,
    );
  }
  return adjusted;
}

/** Texto corto para la confirmación: «Hilux: demanda ×1.2 en 2027-02, 2027-03». */
export function describeFactor(factor: DemandFactor): string {
  const scope = factor.months?.length ? ` en ${factor.months.join(", ")}` : "";
  return `${factor.model}: demanda ×${factor.factor}${scope}`;
}
