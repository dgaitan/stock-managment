import { Checkbox } from "@/components/ui/checkbox";
import { ruleKeyLabel, ruleValueLabel } from "@/lib/bulletins/labels";
import { formatIsoDate } from "@/lib/format";
import type { ActiveRule } from "@/lib/orders/types";

type RulesStepProps = {
  rules: ActiveRule[];
  omitted: number[];
  onToggle: (id: number) => void;
};

function originOf(rule: ActiveRule): { id: string; title: string } {
  return rule.bulletin
    ? { id: `${rule.bulletin.date}|${rule.bulletin.subject}`, title: `${rule.bulletin.subject} · ${formatIsoDate(rule.bulletin.date)}` }
    : { id: "seed", title: "Semilla inicial (sin comunicado vinculado)" };
}

/** Reglas vigentes por comunicado de origen. Las opcionales se pueden omitir solo en este cálculo. */
export function RulesStep({ rules, omitted, onToggle }: RulesStepProps) {
  const groups = new Map<string, { title: string; required: number; optional: ActiveRule[] }>();
  for (const rule of rules) {
    const origin = originOf(rule);
    const group = groups.get(origin.id) ?? { title: origin.title, required: 0, optional: [] };
    if (rule.required) group.required += 1;
    else group.optional.push(rule);
    groups.set(origin.id, group);
  }

  if (rules.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay reglas vigentes para esta ventana.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Estas reglas vienen de los comunicados vigentes. Marca una para omitirla solo en este cálculo.
      </p>
      {[...groups.entries()].map(([id, group]) => (
        <section key={id} className="flex flex-col gap-1.5" aria-label={group.title}>
          <h3 className="text-sm font-semibold">{group.title}</h3>
          {group.required > 0 ? (
            <p className="text-xs text-muted-foreground">{group.required} reglas de lote, obligatorias.</p>
          ) : null}
          {group.optional.map((rule) => (
            <label key={rule.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={omitted.includes(rule.id)} onCheckedChange={() => onToggle(rule.id)} />
              <span className={omitted.includes(rule.id) ? "text-muted-foreground line-through" : undefined}>
                {rule.model} · {ruleKeyLabel(rule.key)}: {ruleValueLabel(rule.key, rule.value)}
              </span>
              <span className="text-xs text-muted-foreground">{omitted.includes(rule.id) ? "omitida" : "se aplica"}</span>
            </label>
          ))}
        </section>
      ))}
    </div>
  );
}
