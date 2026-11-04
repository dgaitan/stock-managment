"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import type { ValidatedConsiderations } from "@/lib/ai/considerations";
import { UserFacingError } from "@/lib/bulletins/service";
import type { ActionResult } from "@/lib/bulletins/types";
import { calculateWithOptions, interpretConsiderations } from "@/lib/orders/calculate";
import { loadCalculationContext } from "@/lib/orders/context";
import { calculationRequestSchema, considerationTextSchema } from "@/lib/orders/request";
import type { CalculationContext } from "@/lib/orders/types";

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

export async function loadCalculationContextAction(): Promise<ActionResult<CalculationContext>> {
  return run(loadCalculationContext, "No se pudieron cargar las reglas vigentes.");
}

export async function interpretConsiderationsAction(text: unknown): Promise<ActionResult<ValidatedConsiderations>> {
  const parsed = considerationTextSchema.safeParse(text);
  if (!parsed.success) {
    await requireSession();
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Texto inválido" };
  }
  return run(() => interpretConsiderations(parsed.data), "No se pudo interpretar el texto. Intenta de nuevo.");
}

export async function calculateOrderAction(
  request: unknown,
): Promise<ActionResult<{ version: number; narrativeFailed: boolean }>> {
  const parsed = calculationRequestSchema.safeParse(request);
  if (!parsed.success) {
    await requireSession();
    return { ok: false, error: "La solicitud de cálculo no es válida." };
  }
  const result = await run(
    () => calculateWithOptions(parsed.data),
    "No se pudo calcular el pedido. Revisa los datos importados e intenta de nuevo.",
  );
  if (result.ok) revalidatePath("/");
  return result;
}
