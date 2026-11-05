import { formatShortDate } from "@/lib/format";
import type { ActiveRule } from "@/lib/orders/types";

export type RuleGroup = { title: string; origin: string; fromBulletin: boolean; required: number; optional: ActiveRule[] };

/** Agrupa las reglas vigentes por comunicado de origen; las de lote van contadas aparte (no se pueden omitir). */
export function groupRulesByBulletin(rules: ActiveRule[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>();
  for (const rule of rules) {
    const id = rule.bulletin ? `${rule.bulletin.date}|${rule.bulletin.subject}` : "seed";
    const group = groups.get(id) ?? {
      title: rule.bulletin?.subject ?? "Reglas iniciales",
      origin: rule.bulletin ? formatShortDate(rule.bulletin.date) : "sin comunicado",
      fromBulletin: rule.bulletin !== null,
      required: 0,
      optional: [],
    };
    if (rule.required) group.required += 1;
    else group.optional.push(rule);
    groups.set(id, group);
  }
  return [...groups.values()];
}

/** ¿Están omitidas todas estas reglas? (Un conjunto vacío no cuenta como omitido.) */
export function allOmitted(ids: number[], omitted: number[]): boolean {
  return ids.length > 0 && ids.every((id) => omitted.includes(id));
}

/** Un comunicado se aplica salvo que todas sus reglas omitibles estén omitidas (los lotes siempre se aplican). */
export function isGroupActive(group: RuleGroup, omitted: number[]): boolean {
  return !allOmitted(group.optional.map((r) => r.id), omitted);
}
