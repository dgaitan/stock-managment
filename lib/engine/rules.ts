// Puro, sin Next/React/DB. Convierte las reglas guardadas (filas de
// `cycle_rules`, extraídas de los comunicados) en la configuración por modelo
// que usa el motor. Una regla "permanent" vale siempre; una de un ciclo solo
// en su ventana, así que la de RAV4 no se arrastra al ciclo siguiente.
// Una clave desconocida o un lote faltante es un error: nunca se ignora en silencio.

import type { ModelConfig } from "@/lib/engine/config";

export const PERMANENT_CYCLE = "permanent";

export interface CycleRuleRow {
  cycle: string; // "permanent" o la ventana ("2026-10")
  model: string;
  key: string;
  value: string;
}

const RULE_KEYS = ["lot_min", "lot_multiple", "lifecycle", "horizon_months", "safety_stock_override"] as const;
type RuleKey = (typeof RULE_KEYS)[number];

function isRuleKey(key: string): key is RuleKey {
  return (RULE_KEYS as readonly string[]).includes(key);
}

/** Modelos con alguna regla, en orden de aparición (nombres canónicos para el parser). */
export function modelNamesFromRules(rows: CycleRuleRow[]): string[] {
  return [...new Set(rows.map((r) => r.model))];
}

function parseNumber(row: CycleRuleRow, minimum: number): number {
  const value = Number(row.value);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`Regla inválida ${row.model}.${row.key}="${row.value}" (ciclo ${row.cycle}): se esperaba un número >= ${minimum}`);
  }
  return value;
}

function applyRule(model: Partial<ModelConfig>, row: CycleRuleRow): void {
  if (!isRuleKey(row.key)) {
    throw new Error(`Regla desconocida ${row.model}.${row.key} (ciclo ${row.cycle}): el motor no la entiende`);
  }
  switch (row.key) {
    case "lot_min":
      model.lot_min = parseNumber(row, 1);
      break;
    case "lot_multiple":
      model.lot_multiple = parseNumber(row, 1);
      break;
    case "horizon_months":
      model.horizon_months = parseNumber(row, 1);
      break;
    case "safety_stock_override":
      model.safety_stock_override = parseNumber(row, 0);
      break;
    case "lifecycle":
      if (row.value !== "active" && row.value !== "last_window") {
        throw new Error(`Regla inválida ${row.model}.lifecycle="${row.value}": use active o last_window`);
      }
      model.lifecycle = row.value;
      break;
  }
}

/**
 * Configuración por modelo vigente en `window`: primero las reglas permanentes y
 * encima las del ciclo, que prevalecen. Exige lote mínimo y múltiplo en cada modelo.
 */
export function resolveModelConfigs(rows: CycleRuleRow[], window: string): ModelConfig[] {
  return modelNamesFromRules(rows).map((name) => {
    const mine = rows.filter((r) => r.model === name);
    const model: Partial<ModelConfig> = { name };
    for (const row of mine.filter((r) => r.cycle === PERMANENT_CYCLE)) applyRule(model, row);
    for (const row of mine.filter((r) => r.cycle === window)) applyRule(model, row);

    if (model.lot_min === undefined || model.lot_multiple === undefined) {
      throw new Error(`Falta el lote (lot_min / lot_multiple) de ${name} para la ventana ${window}`);
    }
    return model as ModelConfig;
  });
}
