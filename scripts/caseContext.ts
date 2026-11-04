// Carga del xlsx para la validación cruzada:
// config de supuestos, reglas vigentes, datos limpios y el ciclo derivado del corte.
// Solo lo usa crosscheck, que valida contra el xlsx crudo. La CLI y la app leen la base (lib/db/loadEngineInputs.ts).

import { type CycleConfig, loadCycleConfig, loadCycleRules, type ModelConfig } from "@/lib/engine/config";
import { type Cycle, deriveCycle, latestInventoryMonthEnd } from "@/lib/engine/cycle";
import type { ModelEconomics } from "@/lib/engine/order";
import { type CycleRuleRow, modelNamesFromRules, resolveModelConfigs } from "@/lib/engine/rules";
import { parseExcelFile } from "@/lib/sources/excel";
import type { NormalizedImport } from "@/lib/sources/types";

export interface CaseContext {
  config: CycleConfig;
  rules: CycleRuleRow[];
  parsed: NormalizedImport;
  cycle: Cycle;
  models: ModelConfig[];
  economicsByModel: Map<string, ModelEconomics>;
}

export function loadCaseContext(filePath: string): CaseContext {
  const config = loadCycleConfig();
  const rules = loadCycleRules();
  const parsed = parseExcelFile(filePath, modelNamesFromRules(rules), {
    fleetOutlierMinUnits: config.fleet_outlier_min_units,
  });
  const cycle = deriveCycle({
    cutoffDate: latestInventoryMonthEnd(parsed.inventory),
    leadTimeMonths: config.lead_time_months,
    windowMonths: config.window_months,
  });

  const economicsByModel = new Map<string, ModelEconomics>();
  for (const e of parsed.economics) {
    if (!e.modelName) continue;
    economicsByModel.set(e.modelName, {
      unitCost: e.avgUnitCost ?? 0,
      marginPct: e.marginPct ?? 0,
      monthlyFinCost: e.monthlyFinCostPerUnit ?? 0,
    });
  }

  return { config, rules, parsed, cycle, models: resolveModelConfigs(rules, cycle.window), economicsByModel };
}
