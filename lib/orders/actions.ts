"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { runOrderAnalysis } from "@/lib/orders/runOrder";

export type CalculateState = { version: number | null; error: string | null };

/** Calcula el pedido con las reglas guardadas y crea una versión nueva del análisis. */
export async function calculateOrder(): Promise<CalculateState> {
  await requireSession();
  try {
    const version = await runOrderAnalysis();
    revalidatePath("/");
    return { version, error: null };
  } catch (error) {
    console.error("No se pudo calcular el pedido", error);
    return { version: null, error: "No se pudo calcular el pedido. Revisa los datos importados e intenta de nuevo." };
  }
}
