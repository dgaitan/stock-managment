// Puro, sin red. Reglas que el LLM extrae del texto de un comunicado y su
// validación determinística: solo pasan modelos del catálogo, claves que el motor
// entiende y valores que el motor acepta (misma validación que usa para cargarlas,
// lib/engine/rules.ts). Lo demás vuelve como «no extraída» con su motivo.

import { z } from "zod";
import { isRuleKey, validateRule } from "@/lib/engine/rules";
import type { NotApplied } from "@/lib/ai/considerations";

export const extractionSchema = z.object({
  rules: z.array(z.object({ model: z.string(), key: z.string(), value: z.string() })),
  notExtracted: z.array(z.object({ text: z.string(), reason: z.string() })),
});
export type RuleExtraction = z.infer<typeof extractionSchema>;

export interface ExtractedRule {
  model: string;
  key: string;
  value: string;
}

export interface ValidatedExtraction {
  rules: ExtractedRule[];
  notExtracted: NotApplied[];
}

/** Identidad de una regla dentro de una vigencia: modelo + clave. */
export function ruleId(model: string, key: string): string {
  return `${model}\u0000${key}`;
}

export function validateExtraction(
  extraction: RuleExtraction,
  ctx: { models: string[]; cycle: string },
): ValidatedExtraction {
  const canonical = new Map(ctx.models.map((m) => [m.toLowerCase(), m]));
  const seen = new Set<string>();
  const rules: ExtractedRule[] = [];
  const notExtracted: NotApplied[] = [...extraction.notExtracted];

  for (const item of extraction.rules) {
    const text = `${item.model}: ${item.key} = ${item.value}`;
    const model = canonical.get(item.model.trim().toLowerCase());
    if (!model) {
      notExtracted.push({ text, reason: `«${item.model}» no es un modelo del catálogo` });
      continue;
    }
    if (!isRuleKey(item.key)) {
      notExtracted.push({ text, reason: `el motor no entiende la regla «${item.key}»` });
      continue;
    }
    try {
      validateRule({ cycle: ctx.cycle, model, key: item.key, value: item.value.trim() });
    } catch (error) {
      notExtracted.push({ text, reason: error instanceof Error ? error.message : "valor inválido" });
      continue;
    }
    const id = ruleId(model, item.key);
    if (seen.has(id)) {
      notExtracted.push({ text, reason: "regla repetida para el mismo modelo" });
      continue;
    }
    seen.add(id);
    rules.push({ model, key: item.key, value: item.value.trim() });
  }
  return { rules, notExtracted };
}
