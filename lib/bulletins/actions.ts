"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { bulletinInputSchema, saveRulesSchema } from "@/lib/bulletins/schemas";
import {
  previewBulletinRules,
  saveBulletin,
  saveBulletinRules,
  setBulletinArchived,
  UserFacingError,
} from "@/lib/bulletins/service";
import type { ActionResult, RulesPreview } from "@/lib/bulletins/types";

// Cada acción verifica la sesión por sí misma y valida la entrada con zod.

async function run<T>(task: () => Promise<T>, failure: string): Promise<ActionResult<T>> {
  await requireSession();
  try {
    return { ok: true, data: await task() };
  } catch (error) {
    if (error instanceof UserFacingError) return { ok: false, error: error.message };
    console.error(failure, error);
    return { ok: false, error: failure };
  }
}

function invalid(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: error.issues[0]?.message ?? "Datos inválidos" };
}

export async function saveBulletinAction(
  input: unknown,
): Promise<ActionResult<{ id: number; rulesCleared: boolean }>> {
  const parsed = bulletinInputSchema.safeParse(input);
  if (!parsed.success) {
    await requireSession();
    return invalid(parsed.error);
  }
  const result = await run(() => saveBulletin(parsed.data), "No se pudo guardar el comunicado.");
  if (result.ok) revalidatePath("/");
  return result;
}

export async function archiveBulletinAction(id: unknown, archived: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.number().int().positive(), archived: z.boolean() }).safeParse({ id, archived });
  if (!parsed.success) {
    await requireSession();
    return invalid(parsed.error);
  }
  const result = await run(async () => {
    await setBulletinArchived(parsed.data.id, parsed.data.archived);
    return null;
  }, "No se pudo archivar el comunicado.");
  if (result.ok) revalidatePath("/");
  return result;
}

export async function previewRulesAction(id: unknown): Promise<ActionResult<RulesPreview>> {
  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) {
    await requireSession();
    return invalid(parsed.error);
  }
  return run(() => previewBulletinRules(parsed.data), "No se pudieron extraer las reglas. Intenta de nuevo.");
}

export async function saveRulesAction(input: unknown): Promise<ActionResult<{ saved: number }>> {
  const parsed = saveRulesSchema.safeParse(input);
  if (!parsed.success) {
    await requireSession();
    return invalid(parsed.error);
  }
  const result = await run(
    async () => ({ saved: await saveBulletinRules(parsed.data.bulletinId, parsed.data.rules) }),
    "No se pudieron guardar las reglas.",
  );
  if (result.ok) revalidatePath("/");
  return result;
}
