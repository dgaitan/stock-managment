import { formatIsoDate } from "@/lib/format";
import type { ActiveRule } from "@/lib/orders/types";

export type RuleGroup = { title: string; origin: string; required: number; optional: ActiveRule[] };

/** Agrupa las reglas vigentes por comunicado de origen; las de lote van contadas aparte (no se pueden omitir). */
export function groupRulesByBulletin(rules: ActiveRule[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>();
  for (const rule of rules) {
    const id = rule.bulletin ? `${rule.bulletin.date}|${rule.bulletin.subject}` : "seed";
    const group = groups.get(id) ?? {
      title: rule.bulletin?.subject ?? "Reglas iniciales",
      origin: rule.bulletin ? formatIsoDate(rule.bulletin.date) : "sin comunicado",
      required: 0,
      optional: [],
    };
    if (rule.required) group.required += 1;
    else group.optional.push(rule);
    groups.set(id, group);
  }
  return [...groups.values()];
}
