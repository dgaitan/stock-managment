import { readFileSync } from "node:fs";
import { parse } from "yaml";

// Pura, sin Next/React/DB. El motor y el CLI leen la config de aqui.
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
  order_coverage_months: number;
  cutoff_date: string;
  order_window_closes: string;
  fleet_outlier_min_units: number;
  min_order_effective_threshold_pct: number;
  forecast_weights: { recent_6m: number; prior_6m: number };
  seasonality_min_years: number;
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
  models: ModelConfig[];
  backtest_cutoffs: string[];
}

export function loadCycleConfig(path = "config/cycle.yaml"): CycleConfig {
  const raw = readFileSync(path, "utf-8");
  return parse(raw) as CycleConfig;
}
