import "server-only";
import { desc, max } from "drizzle-orm";
import { aiModel, getAiClient } from "@/lib/ai/client";
import { writeNarrative, type NarrativeFacts } from "@/lib/ai/narrative";
import { db } from "@/lib/db/client";
import { loadEngineInputs } from "@/lib/db/loadEngineInputs";
import * as schema from "@/lib/db/schema";
import { NO_ADJUSTMENTS, type OrderAdjustments } from "@/lib/engine/adjustments";
import { computeOrderLines, type ComputedLine } from "@/lib/orders/compute";

export interface RunOptions {
  excludedRuleIds: number[]; // reglas omitidas solo en este cálculo
  adjustments: OrderAdjustments;
  // Lo que el planificador escribió y cómo se interpretó; se guarda con el análisis.
  consideration: { text: string; applied: string[]; notApplied: string[] } | null;
}

export const DEFAULT_RUN_OPTIONS: RunOptions = { excludedRuleIds: [], adjustments: NO_ADJUSTMENTS, consideration: null };

function narrativeFacts(window: string, lines: ComputedLine[], applied: string[]): NarrativeFacts {
  return {
    window,
    totalUnits: lines.reduce((acc, l) => acc + l.orderUnits, 0),
    totalCapital: Math.round(lines.reduce((acc, l) => acc + l.capital, 0)),
    considerations: applied,
    lines: lines.map((l) => ({
      model: l.modelName,
      orderUnits: l.orderUnits,
      capital: Math.round(l.capital),
      orderCoverageMonths: Math.round(l.detail.plan.coverageMonthsAchieved * 10) / 10,
      projectedStockAtArrival: Math.round(l.detail.plan.projectedStockAtArrival),
      flags: l.detail.plan.flags,
    })),
  };
}

/** Redacta el análisis con IA si hay API key. Si falla, el pedido igual se guarda: se avisa, no se oculta. */
async function tryNarrative(facts: NarrativeFacts): Promise<{ text: string | null; failed: boolean }> {
  const client = getAiClient();
  if (!client) return { text: null, failed: false };
  try {
    return { text: await writeNarrative({ client: client.messages, model: aiModel(), facts }), failed: false };
  } catch (error) {
    console.error("No se pudo redactar el análisis", error);
    return { text: null, failed: true };
  }
}

/**
 * Calcula el pedido con el motor y lo guarda como un análisis versionado
 * (order_runs + order_lines). Cada llamada crea una versión nueva; las
 * anteriores quedan como historial.
 */
export async function runOrderAnalysis(
  options: RunOptions = DEFAULT_RUN_OPTIONS,
): Promise<{ version: number; narrativeFailed: boolean }> {
  const inputs = await loadEngineInputs(db, undefined, { excludedRuleIds: options.excludedRuleIds });
  const lines = computeOrderLines(inputs, options.adjustments);
  const narrative = await tryNarrative(
    narrativeFacts(inputs.cycle.window, lines, options.consideration?.applied ?? []),
  );
  const modelIds = new Map((await db.select().from(schema.models)).map((m) => [m.name, m.id]));
  const [latestImport] = await db
    .select({ id: schema.imports.id })
    .from(schema.imports)
    .orderBy(desc(schema.imports.id))
    .limit(1);

  const version = await db.transaction(async (tx) => {
    const [{ last }] = await tx.select({ last: max(schema.orderRuns.version) }).from(schema.orderRuns);
    const next = (last ?? 0) + 1;
    const [run] = await tx
      .insert(schema.orderRuns)
      .values({
        version: next,
        importId: latestImport?.id ?? null,
        cutoffDate: inputs.cycle.cutoffDate,
        window: inputs.cycle.window,
        paramsJson: {
          cycle: inputs.cycle,
          models: inputs.models,
          excludedRuleIds: options.excludedRuleIds,
          adjustments: options.adjustments,
          consideration: options.consideration,
        },
        narrative: narrative.text,
      })
      .returning({ id: schema.orderRuns.id });

    await tx.insert(schema.orderLines).values(
      lines.map((line) => ({
        runId: run.id,
        modelId: modelIds.get(line.modelName) ?? null,
        forecastMonthly: line.detail.plan.forecastMonthlyRate.toFixed(2),
        projectedStock: Math.round(line.detail.plan.projectedStockAtArrival),
        need: Math.round(line.detail.plan.need),
        orderUnits: line.orderUnits,
        capital: line.capital.toFixed(2),
        flagsJson: line.detail,
        explanation: line.explanation,
      })),
    );
    return next;
  });
  return { version, narrativeFailed: narrative.failed };
}
