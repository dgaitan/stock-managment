// Puro, sin red. Lo que el LLM puede proponer para «reglas adicionales» y la
// validación determinística que lo acota antes de llegar al motor: modelos que
// existen, factores dentro de rango, meses dentro del horizonte del cálculo. Todo
// lo que no pasa se devuelve como «no aplicada» con su motivo; nada se ignora en silencio.

import { z } from "zod";
import {
  describeFactor,
  MAX_DEMAND_FACTOR,
  MIN_DEMAND_FACTOR,
  type DemandFactor,
  type OrderAdjustments,
} from "@/lib/engine/adjustments";

/** Forma que se le pide al modelo (los rangos se validan abajo, no en el esquema). */
export const proposalSchema = z.object({
  demandFactors: z.array(
    z.object({
      model: z.string(),
      factor: z.number(),
      months: z.array(z.string()).nullable(),
    }),
  ),
  excludedModels: z.array(z.string()),
  notApplied: z.array(z.object({ text: z.string(), reason: z.string() })),
});
export type ConsiderationProposal = z.infer<typeof proposalSchema>;

export interface ConsiderationContext {
  models: string[]; // nombres canónicos
  months: string[]; // "YYYY-MM" que cubre el cálculo (hasta la llegada + cobertura)
}

export interface NotApplied {
  text: string;
  reason: string;
}

export interface ValidatedConsiderations {
  adjustments: OrderAdjustments;
  applied: string[]; // frases para «Se aplica: …»
  notApplied: NotApplied[];
}

export function validateProposal(proposal: ConsiderationProposal, ctx: ConsiderationContext): ValidatedConsiderations {
  const canonical = new Map(ctx.models.map((m) => [m.toLowerCase(), m]));
  const allowedMonths = new Set(ctx.months);
  const demandFactors: DemandFactor[] = [];
  const excluded = new Set<string>();
  const applied: string[] = [];
  const notApplied: NotApplied[] = [...proposal.notApplied];

  for (const item of proposal.demandFactors) {
    const label = describeFactor({ model: item.model, factor: item.factor, months: item.months?.length ? item.months : undefined });
    const model = canonical.get(item.model.trim().toLowerCase());
    if (!model) {
      notApplied.push({ text: label, reason: `«${item.model}» no es un modelo del catálogo` });
      continue;
    }
    if (!Number.isFinite(item.factor) || item.factor < MIN_DEMAND_FACTOR || item.factor > MAX_DEMAND_FACTOR) {
      notApplied.push({
        text: label,
        reason: `el factor debe estar entre ${MIN_DEMAND_FACTOR} y ${MAX_DEMAND_FACTOR}`,
      });
      continue;
    }
    const months = item.months?.length ? [...new Set(item.months)] : undefined;
    const outside = months?.filter((m) => !allowedMonths.has(m));
    if (outside?.length) {
      notApplied.push({ text: label, reason: `meses fuera del horizonte del cálculo: ${outside.join(", ")}` });
      continue;
    }
    const factor: DemandFactor = { model, factor: item.factor, ...(months ? { months } : {}) };
    demandFactors.push(factor);
    applied.push(describeFactor(factor));
  }

  for (const name of proposal.excludedModels) {
    const model = canonical.get(name.trim().toLowerCase());
    if (!model) {
      notApplied.push({ text: `Excluir ${name}`, reason: `«${name}» no es un modelo del catálogo` });
    } else if (!excluded.has(model)) {
      excluded.add(model);
      applied.push(`${model}: excluido del pedido`);
    }
  }

  return { adjustments: { demandFactors, excludedModels: [...excluded] }, applied, notApplied };
}
