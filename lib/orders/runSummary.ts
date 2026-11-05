// Texto de la línea de total: con qué reglas se calculó el análisis. Puro, sin servidor.

import { formatDecimal } from "@/lib/format";
import type { OrderLineView, OrderRunView, RunSummary } from "@/lib/orders/types";

/** «reglas de los comunicados, sin consideraciones adicionales», «… + 1 tuya», «… · 2 omitidas». */
export function describeRunRules(userRules: number, omittedRules: number): string {
  const base =
    userRules === 0
      ? "reglas de los comunicados, sin consideraciones adicionales"
      : `reglas de los comunicados + ${userRules} ${userRules === 1 ? "tuya" : "tuyas"}`;
  if (omittedRules === 0) return base;
  return `${base} · ${omittedRules} ${omittedRules === 1 ? "omitida" : "omitidas"}`;
}

/** ¿Cambió el pedido del modelo contra el análisis anterior? (Sin análisis anterior no hay cambio.) */
export function lineChanged(line: Pick<OrderLineView, "orderUnits" | "previousOrderUnits">): boolean {
  return line.previousOrderUnits !== null && line.previousOrderUnits !== line.orderUnits;
}

export function summarizeRun(run: Pick<OrderRunView, "version" | "totalUnits" | "totalCapital" | "lines">): RunSummary {
  return {
    version: run.version,
    totalUnits: run.totalUnits,
    totalCapital: run.totalCapital,
    changes: run.lines
      .filter(lineChanged)
      .map((l) => ({ model: l.modelName, delta: l.orderUnits - (l.previousOrderUnits ?? 0) })),
  };
}

/** Insignia de la regla del planificador para un modelo: «Tu regla ×1,2». */
export function demandFactorLabel(factor: number): string {
  return `Tu regla ×${formatDecimal(factor)}`;
}
