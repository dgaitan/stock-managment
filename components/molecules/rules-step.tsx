import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ruleKeyLabel, ruleValueLabel } from "@/lib/bulletins/labels";
import { isGroupActive, type RuleGroup } from "@/lib/orders/ruleGroups";

type RulesStepProps = {
  groups: RuleGroup[];
  omitted: number[];
  onToggle: (ids: number[]) => void;
  onManageBulletins: () => void;
};

function describe(group: RuleGroup): string {
  const optional = group.optional.map((r) => `${r.model} · ${ruleKeyLabel(r.key)}: ${ruleValueLabel(r.key, r.value)}`);
  const lots = group.required > 0 ? [`${group.required} reglas de lote (mínimo y múltiplo por modelo), obligatorias`] : [];
  return [...lots, ...optional].join("; ");
}

/** Una fila por comunicado: marcada = se aplica; desmarcar la excluye solo de este cálculo. Los lotes no se excluyen. */
export function RulesStep({ groups, omitted, onToggle, onManageBulletins }: RulesStepProps) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px]">Estas reglas salen de los comunicados guardados. Desmarca una para excluirla solo de este cálculo.</p>
        <Button variant="link" size="inline" className="font-normal" onClick={onManageBulletins}>
          Gestionar comunicados
        </Button>
      </div>
      {groups.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Sin reglas vigentes.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {groups.map((group) => {
            const ids = group.optional.map((r) => r.id);
            const locked = ids.length === 0;
            const checked = isGroupActive(group, omitted);
            return (
              <label
                key={`${group.origin}-${group.title}`}
                className={`flex items-start gap-3 border-b border-hairline px-3.5 py-3 last:border-b-0 ${locked ? "" : "cursor-pointer"}`}
              >
                <Checkbox className="mt-[3px]" checked={checked} disabled={locked} onCheckedChange={() => onToggle(ids)} />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[13px]">{describe(group)}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.title} · {group.origin}
                  </span>
                </span>
                {group.fromBulletin ? <Badge variant="blue">De comunicado</Badge> : null}
              </label>
            );
          })}
        </div>
      )}
    </>
  );
}
