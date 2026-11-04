import "server-only";
import { aiModel, getAiClient } from "@/lib/ai/client";
import { validateProposal, type ConsiderationContext, type ValidatedConsiderations } from "@/lib/ai/considerations";
import { translateConsiderations } from "@/lib/ai/rules";
import { NO_ADJUSTMENTS } from "@/lib/engine/adjustments";
import { UserFacingError, saveBulletin } from "@/lib/bulletins/service";
import { todayIsoDate } from "@/lib/format";
import { loadCalculationContext } from "@/lib/orders/context";
import { findInvalidOmission } from "@/lib/orders/omittable";
import type { CalculationRequest } from "@/lib/orders/request";
import { runOrderAnalysis } from "@/lib/orders/runOrder";
import type { CalculationContext } from "@/lib/orders/types";

function considerationContext(ctx: CalculationContext): ConsiderationContext {
  return { models: ctx.models, months: ctx.months };
}

/** Paso «Reglas adicionales» → «Confirmar»: interpreta el texto, sin guardar nada. */
export async function interpretConsiderations(text: string): Promise<ValidatedConsiderations> {
  const client = getAiClient();
  if (!client) throw new UserFacingError("Las reglas adicionales requieren ANTHROPIC_API_KEY.");
  const ctx = await loadCalculationContext();
  return translateConsiderations({
    client: client.messages,
    model: aiModel(),
    text,
    context: considerationContext(ctx),
  });
}

/**
 * Calcula con lo que el planificador confirmó. Nada del cliente se acepta tal cual: las
 * reglas omitidas deben ser reglas vigentes no obligatorias y las consideraciones se
 * validan de nuevo contra los modelos y meses del cálculo.
 */
export async function calculateWithOptions(
  request: CalculationRequest,
): Promise<{ version: number; narrativeFailed: boolean }> {
  const ctx = await loadCalculationContext();

  if (findInvalidOmission(ctx.rules, request.excludedRuleIds) !== undefined) {
    throw new UserFacingError("Una de las reglas a omitir ya no existe o no se puede omitir (el lote es obligatorio).");
  }

  const consideration = request.considerations;
  const validated = consideration
    ? validateProposal({ ...consideration, notApplied: [] }, considerationContext(ctx))
    : null;

  if (consideration && validated && request.saveAsBulletin) {
    const stamp = new Date().toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" });
    await saveBulletin({
      id: null,
      date: todayIsoDate(),
      issuer: "Planificador",
      subject: `Consideración del planificador ${stamp}`,
      body: consideration.text,
      scope: "cycle",
      cycle: ctx.window,
    });
  }

  return runOrderAnalysis({
    excludedRuleIds: request.excludedRuleIds,
    adjustments: validated?.adjustments ?? NO_ADJUSTMENTS,
    consideration:
      consideration && validated
        ? {
            text: consideration.text,
            applied: validated.applied,
            notApplied: validated.notApplied.map((n) => `${n.text}: ${n.reason}`),
          }
        : null,
  });
}
