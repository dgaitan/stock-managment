import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { aiModel, getAiClient } from "@/lib/ai/client";
import { extractBulletinRules } from "@/lib/ai/bulletinRules";
import { ruleId, validateExtraction, type ExtractedRule } from "@/lib/ai/ruleExtraction";
import { planBulletinUpdate, ruleCycle } from "@/lib/bulletins/plan";
import type { BulletinInput } from "@/lib/bulletins/schemas";
import type { RulesPreview } from "@/lib/bulletins/types";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

// Operaciones de base de datos de los comunicados. Las Server Actions (con sesión y
// zod) son la única entrada; este módulo asume entrada ya validada.

export class UserFacingError extends Error {}

async function getBulletin(id: number) {
  const [bulletin] = await db.select().from(schema.bulletins).where(eq(schema.bulletins.id, id));
  if (!bulletin) throw new UserFacingError("El comunicado ya no existe.");
  return bulletin;
}

/** Crea o edita un comunicado. Devuelve true si cambió la vigencia y se quitaron sus reglas. */
export async function saveBulletin(input: BulletinInput): Promise<{ id: number; rulesCleared: boolean }> {
  const cycle = input.scope === "cycle" ? input.cycle : null;

  if (input.id === null) {
    await assertUnique(input.date, input.subject, null);
    const [created] = await db
      .insert(schema.bulletins)
      .values({
        date: input.date,
        issuer: input.issuer,
        subject: input.subject,
        body: input.body,
        source: "user",
        scope: input.scope,
        cycle,
      })
      .returning({ id: schema.bulletins.id });
    return { id: created.id, rulesCleared: false };
  }

  const existing = await getBulletin(input.id);
  const plan = planBulletinUpdate(existing, input);
  await assertUnique(plan.date, plan.subject, existing.id);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.bulletins)
      .set({
        date: plan.date,
        subject: plan.subject,
        issuer: input.issuer,
        body: input.body,
        scope: input.scope,
        cycle: plan.cycle,
        updatedAt: new Date(),
      })
      .where(eq(schema.bulletins.id, existing.id));
    // Las reglas viven en la vigencia con la que se extrajeron: si cambia, hay que extraerlas de nuevo.
    if (plan.vigenciaChanged) await tx.delete(schema.cycleRules).where(eq(schema.cycleRules.bulletinId, existing.id));
  });
  return { id: existing.id, rulesCleared: plan.vigenciaChanged };
}

async function assertUnique(date: string, subject: string, exceptId: number | null): Promise<void> {
  const clash = await db
    .select({ id: schema.bulletins.id })
    .from(schema.bulletins)
    .where(
      and(
        eq(schema.bulletins.date, date),
        eq(schema.bulletins.subject, subject),
        exceptId === null ? undefined : ne(schema.bulletins.id, exceptId),
      ),
    );
  if (clash.length > 0) throw new UserFacingError("Ya existe un comunicado con esa fecha y asunto.");
}

export async function setBulletinArchived(id: number, archived: boolean): Promise<void> {
  await getBulletin(id);
  await db
    .update(schema.bulletins)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(schema.bulletins.id, id));
}

/** Pide a la IA las reglas del comunicado y las compara con las vigentes. No escribe nada. */
export async function previewBulletinRules(id: number): Promise<RulesPreview> {
  const client = getAiClient();
  if (!client) throw new UserFacingError("La extracción con IA requiere ANTHROPIC_API_KEY.");
  const bulletin = await getBulletin(id);
  const cycle = ruleCycle(bulletin);
  const models = (await db.select({ name: schema.models.name }).from(schema.models)).map((m) => m.name);

  const result = await extractBulletinRules({
    client: client.messages,
    model: aiModel(),
    bulletin: { date: bulletin.date, subject: bulletin.subject, body: bulletin.body ?? "" },
    models,
    cycle,
  });
  const current = await currentRuleValues(cycle);
  return {
    rules: result.rules.map((r) => ({ ...r, current: current.get(ruleId(r.model, r.key)) ?? null })),
    notExtracted: result.notExtracted,
  };
}

async function currentRuleValues(cycle: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ model: schema.models.name, key: schema.cycleRules.key, value: schema.cycleRules.value })
    .from(schema.cycleRules)
    .innerJoin(schema.models, eq(schema.models.id, schema.cycleRules.modelId))
    .where(eq(schema.cycleRules.cycle, cycle));
  return new Map(rows.map((r) => [ruleId(r.model, r.key), r.value]));
}

/**
 * Guarda las reglas confirmadas del comunicado. Se vuelven a validar aquí (el cliente
 * no es de fiar) y se escriben en una sola transacción: sustituyen las anteriores de
 * este comunicado y pisan, por modelo y clave, las de otro origen en la misma vigencia.
 */
export async function saveBulletinRules(bulletinId: number, rules: ExtractedRule[]): Promise<number> {
  const bulletin = await getBulletin(bulletinId);
  const cycle = ruleCycle(bulletin);
  const modelRows = await db.select().from(schema.models);
  const checked = validateExtraction({ rules, notExtracted: [] }, { models: modelRows.map((m) => m.name), cycle });
  if (checked.notExtracted.length > 0) {
    throw new UserFacingError(`Hay reglas inválidas: ${checked.notExtracted[0].reason}`);
  }
  const modelId = new Map(modelRows.map((m) => [m.name, m.id]));

  await db.transaction(async (tx) => {
    await tx.delete(schema.cycleRules).where(eq(schema.cycleRules.bulletinId, bulletinId));
    for (const rule of checked.rules) {
      await tx
        .insert(schema.cycleRules)
        .values({
          cycle,
          modelId: modelId.get(rule.model) as number,
          key: rule.key,
          value: rule.value,
          source: "bulletin",
          bulletinId,
        })
        .onConflictDoUpdate({
          target: [schema.cycleRules.cycle, schema.cycleRules.modelId, schema.cycleRules.key],
          set: { value: rule.value, source: "bulletin", bulletinId },
        });
    }
  });
  return checked.rules.length;
}
