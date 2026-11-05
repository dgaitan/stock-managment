import "server-only";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import type { Cycle } from "@/lib/engine/cycle";
import type { RunOptions } from "@/lib/orders/runOrder";
import { describeRunRules } from "@/lib/orders/runSummary";
import type { OrderLineDetail, OrderLineView, OrderRunView } from "@/lib/orders/types";

/** Análisis más reciente con el cambio contra el anterior, o null si aún no hay ninguno. */
export async function getLatestOrderRun(): Promise<OrderRunView | null> {
  const [run, previous] = await db.select().from(schema.orderRuns).orderBy(desc(schema.orderRuns.version)).limit(2);
  if (!run) return null;

  const runIds = previous ? [run.id, previous.id] : [run.id];
  const [lineRows, modelRows] = await Promise.all([
    db.select().from(schema.orderLines).where(inArray(schema.orderLines.runId, runIds)),
    db.select({ id: schema.models.id, name: schema.models.name }).from(schema.models),
  ]);
  const modelName = new Map(modelRows.map((m) => [m.id, m.name]));
  const previousUnits = new Map(
    lineRows.filter((l) => previous && l.runId === previous.id).map((l) => [l.modelId, l.orderUnits]),
  );

  // Análisis guardados antes de las consideraciones no traen las opciones del cálculo.
  const params = run.paramsJson as { cycle: Cycle } & Partial<RunOptions>;
  const factorByModel = new Map((params.adjustments?.demandFactors ?? []).map((f) => [f.model, f.factor]));

  const lines: OrderLineView[] = lineRows
    .filter((l) => l.runId === run.id && l.modelId !== null && l.flagsJson)
    .map((l) => ({
      modelId: l.modelId as number,
      modelName: modelName.get(l.modelId as number) ?? "",
      orderUnits: l.orderUnits,
      capital: Number(l.capital ?? 0),
      previousOrderUnits: previous ? (previousUnits.get(l.modelId) ?? 0) : null,
      demandFactor: factorByModel.get(modelName.get(l.modelId as number) ?? "") ?? null,
      explanation: l.explanation ?? "",
      detail: l.flagsJson as OrderLineDetail,
    }))
    .sort((a, b) => b.orderUnits - a.orderUnits || a.modelName.localeCompare(b.modelName));

  const { cycle } = params;
  return {
    id: run.id,
    version: run.version,
    createdAt: run.createdAt,
    cutoffDate: run.cutoffDate,
    window: run.window,
    arrivalMonth: cycle.arrivalMonth,
    windowCloses: cycle.windowCloses,
    totalUnits: lines.reduce((acc, l) => acc + l.orderUnits, 0),
    totalCapital: lines.reduce((acc, l) => acc + l.capital, 0),
    narrative: run.narrative,
    rulesSummary: describeRunRules(params.consideration?.applied.length ?? 0, params.excludedRuleIds?.length ?? 0),
    lines,
  };
}
