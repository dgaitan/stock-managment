import { InfoTip } from "@/components/molecules/info-tip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ruleKeyLabel, ruleValueLabel } from "@/lib/bulletins/labels";
import { groupRulesByBulletin } from "@/lib/orders/ruleGroups";
import type { ActiveRule } from "@/lib/orders/types";

type RulesStepProps = {
  rules: ActiveRule[];
  omitted: number[];
  onToggle: (id: number) => void;
};

/** Lista de reglas vigentes: marcada = se aplica; desmarcar la excluye solo de este cálculo. */
export function RulesStep({ rules, omitted, onToggle }: RulesStepProps) {
  if (rules.length === 0) return <p className="text-sm text-muted-foreground">Sin reglas vigentes.</p>;

  return (
    <div className="overflow-hidden rounded-lg border">
      {groupRulesByBulletin(rules).map((group) => (
        <section key={`${group.origin}-${group.title}`} aria-label={group.title} className="border-b last:border-b-0">
          <div className="flex items-center gap-2 bg-muted/40 px-3.5 py-2">
            <h3 className="text-[13px] font-medium">{group.title}</h3>
            <span className="text-xs text-muted-foreground">{group.origin}</span>
            {group.required > 0 ? (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                {group.required} de lote
                <InfoTip label="Reglas obligatorias">Los lotes y mínimos de fábrica no se pueden excluir.</InfoTip>
              </span>
            ) : null}
          </div>
          {group.optional.map((rule) => (
            <label key={rule.id} className="flex cursor-pointer items-center gap-3 border-t px-3.5 py-3 text-[13px]">
              <Checkbox checked={!omitted.includes(rule.id)} onCheckedChange={() => onToggle(rule.id)} />
              <span className="flex-1">
                {rule.model} · {ruleKeyLabel(rule.key)}: {ruleValueLabel(rule.key, rule.value)}
              </span>
              {rule.bulletin ? (
                <Badge variant="outline" className="border-blue-200 bg-blue-100 text-blue-900">
                  Extraída por IA
                </Badge>
              ) : null}
            </label>
          ))}
        </section>
      ))}
    </div>
  );
}
