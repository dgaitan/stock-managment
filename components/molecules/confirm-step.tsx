import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ruleKeyLabel, ruleValueLabel } from "@/lib/bulletins/labels";
import type { ValidatedConsiderations } from "@/lib/ai/considerations";
import type { ActiveRule } from "@/lib/orders/types";

type ConfirmStepProps = {
  omittedRules: ActiveRule[];
  interpretation: ValidatedConsiderations | null;
  saveAsBulletin: boolean;
  onSaveChange: (value: boolean) => void;
};

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Resumen antes de calcular: qué se aplica y qué no. Nada se ignora en silencio. */
export function ConfirmStep({ omittedRules, interpretation, saveAsBulletin, onSaveChange }: ConfirmStepProps) {
  const applied = interpretation?.applied ?? [];
  const notApplied = interpretation?.notApplied ?? [];
  const nothingExtra = omittedRules.length === 0 && !interpretation;

  return (
    <div className="flex flex-col gap-4">
      {nothingExtra ? (
        <p className="text-sm">Se calcula con todas las reglas vigentes y sin consideraciones adicionales.</p>
      ) : null}
      {omittedRules.length > 0 ? (
        <Block title="Reglas omitidas en este cálculo">
          <ul className="text-sm text-muted-foreground">
            {omittedRules.map((rule) => (
              <li key={rule.id}>
                {rule.model} · {ruleKeyLabel(rule.key)}: {ruleValueLabel(rule.key, rule.value)}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
      {interpretation ? (
        <>
          <Block title="Se aplica">
            {applied.length > 0 ? (
              <ul className="text-sm">
                {applied.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nada de lo escrito se pudo traducir a parámetros del motor.</p>
            )}
          </Block>
          {notApplied.length > 0 ? (
            <Block title="No se aplica">
              <ul className="text-sm text-muted-foreground">
                {notApplied.map((item) => (
                  <li key={`${item.text}-${item.reason}`}>
                    «{item.text}» — {item.reason}
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={saveAsBulletin} onCheckedChange={(checked) => onSaveChange(checked === true)} />
            Guardar el texto como comunicado para próximos ciclos
          </label>
        </>
      ) : null}
    </div>
  );
}
