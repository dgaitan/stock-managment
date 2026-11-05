"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { UserFacingError } from "@/lib/bulletins/service";
import type { ActionResult } from "@/lib/bulletins/types";
import { workbookFileSchema } from "@/lib/import/schemas";
import { confirmWorkbook, previewWorkbook } from "@/lib/import/service";
import type { ImportPreviewView } from "@/lib/import/types";

// Cada acción verifica la sesión y valida el archivo con zod antes de tocar la base.

async function withWorkbook<T>(
  formData: FormData,
  failure: string,
  task: (bytes: Uint8Array, filename: string) => Promise<T>,
): Promise<ActionResult<T>> {
  await requireSession();
  const parsed = workbookFileSchema.safeParse(formData.get("file"));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Archivo inválido." };
  try {
    return { ok: true, data: await task(new Uint8Array(await parsed.data.arrayBuffer()), parsed.data.name) };
  } catch (error) {
    if (error instanceof UserFacingError) return { ok: false, error: error.message };
    console.error(failure, error);
    return { ok: false, error: failure };
  }
}

export async function previewImportAction(formData: FormData): Promise<ActionResult<ImportPreviewView>> {
  return withWorkbook(formData, "No se pudo revisar el archivo.", previewWorkbook);
}

export async function confirmImportAction(formData: FormData): Promise<ActionResult<{ noop: boolean }>> {
  const result = await withWorkbook(formData, "No se pudo importar el archivo.", confirmWorkbook);
  if (result.ok) revalidatePath("/");
  return result;
}
