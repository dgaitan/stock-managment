import * as schema from "@/lib/db/schema";
import type { Database } from "@/lib/db/factRows";
import { type CycleConfig, loadCycleConfig, type ModelConfig } from "@/lib/engine/config";
import { type Cycle, deriveCycle, latestInventoryMonthEnd } from "@/lib/engine/cycle";
import type { EngineData } from "@/lib/engine/inputs";
import type { ModelEconomics } from "@/lib/engine/order";
import { type CycleRuleRow, resolveModelConfigs } from "@/lib/engine/rules";

// Único cargador del motor: lee la base y arma todo lo que el cálculo necesita
// (datos, reglas vigentes, ciclo derivado y economía). La CLI y la app lo usan,
// así ambas dan las mismas cifras. Los supuestos de pronóstico siguen en
// config/cycle.yaml; lo demás sale de la base.

export interface EngineInputs {
  config: CycleConfig;
  rules: CycleRuleRow[];
  data: EngineData;
  cycle: Cycle;
  models: ModelConfig[];
  economicsByModel: Map<string, ModelEconomics>;
}

export async function loadEngineInputs(db: Database, config: CycleConfig = loadCycleConfig()): Promise<EngineInputs> {
  const [modelRows, saleRows, leadRows, inventoryRows, orderRows, ruleRows, lossReasonRows] = await Promise.all([
    db.select().from(schema.models),
    db.select().from(schema.sales),
    db.select().from(schema.leads),
    db.select().from(schema.inventorySnapshots),
    db.select().from(schema.factoryOrders),
    db.select().from(schema.cycleRules),
    db.select().from(schema.lossReasons),
  ]);

  const nameById = new Map(modelRows.map((m) => [m.id, m.name]));
  const modelName = (id: number | null) => (id === null ? null : (nameById.get(id) ?? null));
  const categoryById = new Map(lossReasonRows.map((r) => [r.id, r.category]));

  const data: EngineData = {
    sales: saleRows.map((s) => ({
      date: s.date,
      modelName: modelName(s.modelId),
      version: s.version,
      units: s.units,
      isFleetOutlier: s.isFleetOutlier,
    })),
    leads: leadRows.map((l) => ({
      closedAt: l.closedAt,
      modelName: modelName(l.modelId),
      version: l.version,
      units: l.units,
      result: l.result,
      lossReasonCategory: l.reasonId === null ? null : (categoryById.get(l.reasonId) ?? null),
      boughtModelName: modelName(l.boughtModelId),
    })),
    inventory: inventoryRows.map((i) => ({
      monthEnd: i.monthEnd,
      avgAgeDays: i.avgAgeDays,
      modelName: modelName(i.modelId),
      units: i.units,
    })),
    factoryOrders: orderRows.map((o) => ({
      modelName: modelName(o.modelId),
      version: o.version,
      orderDate: o.orderDate,
      units: o.units,
      eta: o.eta,
      receivedAt: o.receivedAt,
    })),
  };

  const rules: CycleRuleRow[] = ruleRows.flatMap((r) => {
    const model = nameById.get(r.modelId);
    return model ? [{ cycle: r.cycle, model, key: r.key, value: r.value }] : [];
  });

  const cycle = deriveCycle({
    cutoffDate: latestInventoryMonthEnd(data.inventory),
    leadTimeMonths: config.lead_time_months,
    windowMonths: config.window_months,
  });

  const economicsByModel = new Map<string, ModelEconomics>(
    modelRows.map((m) => [
      m.name,
      { unitCost: Number(m.unitCost), marginPct: Number(m.marginPct), monthlyFinCost: Number(m.monthlyFinCost) },
    ]),
  );

  return { config, rules, data, cycle, models: resolveModelConfigs(rules, cycle.window), economicsByModel };
}
