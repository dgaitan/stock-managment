import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/molecules/info-tip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ValidatedConsiderations } from "@/lib/ai/considerations";
import { groupRulesByBulletin } from "@/lib/orders/ruleGroups";
import type { ActiveRule } from "@/lib/orders/types";

type ConfirmStepProps = {
  rules: ActiveRule[];
  omitted: number[];
  interpretation: ValidatedConsiderations | null;
  saveAsBulletin: boolean;
  onSaveChange: (value: boolean) => void;
};

function Section({ title, tip, children }: { title: ReactNode; tip?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1 text-sm font-semibold">
        {title}
        {tip ? <InfoTip label="Más información">{tip}</InfoTip> : null}
      </h3>
      {children}
    </section>
  );
}

function Interpreted({ tone, label, children }: { tone: "applied" | "skipped"; label: string; children: ReactNode }) {
  const styles =
    tone === "applied"
      ? { box: "border-green-200 bg-green-50", badge: "border-green-200 bg-green-100 text-green-900" }
      : { box: "border-amber-200 bg-amber-50", badge: "border-amber-200 bg-amber-100 text-amber-900" };
  return (
    <li className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13px] ${styles.box}`}>
      <Badge variant="outline" className={styles.badge}>
        {label}
      </Badge>
      <span className="flex-1">{children}</span>
    </li>
  );
}

/** Resumen antes de calcular: qué se aplica y qué no. Nada se ignora en silencio. */
export function ConfirmStep({ rules, omitted, interpretation, saveAsBulletin, onSaveChange }: ConfirmStepProps) {
  const applied = interpretation?.applied ?? [];
  const notApplied = interpretation?.notApplied ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Section
        title={
          <>
            Reglas de los comunicados <span className="font-normal text-muted-foreground">· {rules.length - omitted.length}</span>
          </>
        }
      >
        <ul className="flex flex-wrap gap-1.5">
          {groupRulesByBulletin(rules).map((group) => {
            const off = group.optional.filter((r) => omitted.includes(r.id)).length;
            return (
              <li key={`${group.origin}-${group.title}`}>
                <Badge variant="outline" className="h-auto gap-1.5 px-2.5 py-1">
                  <CheckIcon aria-hidden className="text-green-700" />
                  {group.title}
                  {off > 0 ? <span className="text-muted-foreground">· −{off}</span> : null}
                </Badge>
              </li>
            );
          })}
        </ul>
      </Section>
      {interpretation ? (
        <Section title="Tus reglas, así se interpretaron" tip="La IA no calcula cantidades: el motor calcula con estos parámetros.">
          <ul className="flex flex-col gap-2">
            {applied.map((item) => (
              <Interpreted key={item} tone="applied" label="Se aplica">
                {item}
              </Interpreted>
            ))}
            {notApplied.map((item) => (
              <Interpreted key={`${item.text}-${item.reason}`} tone="skipped" label="No se aplica">
                «{item.text}»
                <span className="block text-xs text-muted-foreground">{item.reason}</span>
              </Interpreted>
            ))}
          </ul>
          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox checked={saveAsBulletin} onCheckedChange={(checked) => onSaveChange(checked === true)} />
            Guardar como comunicado para próximos ciclos
          </label>
        </Section>
      ) : null}
    </div>
  );
}
