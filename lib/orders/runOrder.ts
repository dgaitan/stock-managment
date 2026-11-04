import "server-only";
import { desc, max } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loadEngineInputs } from "@/lib/db/loadEngineInputs";
import * as schema from "@/lib/db/schema";
import { computeOrderLines } from "@/lib/orders/compute";

/**
 * Calcula el pedido con el motor y lo guarda como un análisis versionado
 * (order_runs + order_lines). Cada llamada crea una versión nueva; las
 * anteriores quedan como historial. Devuelve el número de versión.
 */
export async function runOrderAnalysis(): Promise<number> {
  const inputs = await loadEngineInputs(db);
  const lines = computeOrderLines(inputs);
  const modelIds = new Map((await db.select().from(schema.models)).map((m) => [m.name, m.id]));
  const [latestImport] = await db
    .select({ id: schema.imports.id })
    .from(schema.imports)
    .orderBy(desc(schema.imports.id))
    .limit(1);

  return db.transaction(async (tx) => {
    const [{ last }] = await tx.select({ last: max(schema.orderRuns.version) }).from(schema.orderRuns);
    const version = (last ?? 0) + 1;
    const [run] = await tx
      .insert(schema.orderRuns)
      .values({
        version,
        importId: latestImport?.id ?? null,
        cutoffDate: inputs.cycle.cutoffDate,
        window: inputs.cycle.window,
        paramsJson: { cycle: inputs.cycle, models: inputs.models },
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
    return version;
  });
}
