import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { isAiEnabled } from "@/lib/ai/client";
import { db } from "@/lib/db/client";
import { loadEngineInputs } from "@/lib/db/loadEngineInputs";
import * as schema from "@/lib/db/schema";
import { PERMANENT_CYCLE, REQUIRED_RULE_KEYS, isRuleKey } from "@/lib/engine/rules";
import type { ActiveRule, CalculationContext } from "@/lib/orders/types";

/** Reglas que valen para la ventana (permanentes y de la ventana), sin las de comunicados archivados. */
export async function loadActiveRules(window: string): Promise<ActiveRule[]> {
  const rows = await db
    .select({
      id: schema.cycleRules.id,
      cycle: schema.cycleRules.cycle,
      model: schema.models.name,
      key: schema.cycleRules.key,
      value: schema.cycleRules.value,
      subject: schema.bulletins.subject,
      date: schema.bulletins.date,
    })
    .from(schema.cycleRules)
    .innerJoin(schema.models, eq(schema.models.id, schema.cycleRules.modelId))
    .leftJoin(schema.bulletins, eq(schema.bulletins.id, schema.cycleRules.bulletinId))
    .where(
      and(
        inArray(schema.cycleRules.cycle, [PERMANENT_CYCLE, window]),
        or(isNull(schema.bulletins.id), isNull(schema.bulletins.archivedAt)),
      ),
    )
    .orderBy(schema.models.name, schema.cycleRules.key);

  return rows.map((r) => ({
    id: r.id,
    model: r.model,
    key: r.key,
    value: r.value,
    cycle: r.cycle,
    bulletin: r.subject && r.date ? { subject: r.subject, date: r.date } : null,
    required: isRuleKey(r.key) && REQUIRED_RULE_KEYS.includes(r.key),
  }));
}

export async function loadCalculationContext(): Promise<CalculationContext> {
  const inputs = await loadEngineInputs(db);
  const { cycle } = inputs;
  return {
    window: cycle.window,
    arrivalMonth: cycle.arrivalMonth,
    models: inputs.models.map((m) => m.name),
    months: [...cycle.gapMonths, ...cycle.coverageMonths],
    rules: await loadActiveRules(cycle.window),
    aiEnabled: isAiEnabled(),
  };
}
