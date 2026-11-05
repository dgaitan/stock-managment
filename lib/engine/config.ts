import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { type CycleRuleRow, PERMANENT_CYCLE } from "@/lib/engine/rules";

// Pura, sin Next/React/DB. El motor y el CLI leen la config de aqui.
// Solo supuestos de pronóstico: lo que cambia por ciclo (corte, ventana, llegada,
// lotes, regla RAV4) sale de los datos y de las reglas (ver cycle.ts y rules.ts).
export interface ModelConfig {
  name: string;
  lot_min: number;
  lot_multiple: number;
  lifecycle?: "active" | "last_window";
  horizon_months?: number;
  safety_stock_override?: number;
}

export interface CycleConfig {
  lead_time_months: number;
  window_months: number[]; // meses (1-12) en que fábrica recibe pedidos
  fleet_outlier_min_units: number;
  min_order_effective_threshold_pct: number;
  stockout_min_stock_fraction: number;
  version_mix_window_months: number;
  forecast_weights: { recent_6m: number; prior_6m: number };
  seasonality_min_years: number;
  min_history_months: number; // menos historia tras importar -> advertencia
  safety_stock: {
    z_high_margin: number;
    z_mid_margin: number;
    z_low_margin_or_high_fin_cost: number;
    margin_high_threshold_pct: number;
    margin_low_threshold_pct: number;
    high_fin_cost_monthly_threshold: number;
  };
  plan_piso_monthly_pct: number;
  aging_discounts: Record<string, number>;
  loss_reason_categories: string[];
  backtest_cutoffs: string[];
}

export function loadCycleConfig(path = "config/cycle.yaml"): CycleConfig {
  const raw = readFileSync(path, "utf-8");
  return parse(raw) as CycleConfig;
}

/**
 * Reglas semilla (lotes de los comunicados, regla RAV4) como filas de `cycle_rules`.
 * Formato del archivo: `<ciclo | permanent>: { <modelo>: { <clave>: <valor> } }`.
 * Hasta que el motor lea de la base, los scripts de xlsx cargan las reglas de aquí.
 */
export function loadCycleRules(path = "config/cycle_rules.yaml"): CycleRuleRow[] {
  const tree = parse(readFileSync(path, "utf-8")) as Record<string, Record<string, Record<string, unknown>>>;
  const rows: CycleRuleRow[] = [];
  for (const [cycle, models] of Object.entries(tree)) {
    if (cycle !== PERMANENT_CYCLE && !/^\d{4}-\d{2}$/.test(cycle)) {
      throw new Error(`Ciclo inválido en ${path}: "${cycle}" (use "permanent" o "AAAA-MM")`);
    }
    for (const [model, rules] of Object.entries(models)) {
      for (const [key, value] of Object.entries(rules)) rows.push({ cycle, model, key, value: String(value) });
    }
  }
  return rows;
}
