import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { ValidatedConsiderations } from "@/lib/ai/considerations";
import { isGroupActive, type RuleGroup } from "@/lib/orders/ruleGroups";

type ConfirmStepProps = {
  groups: RuleGroup[];
  omitted: number[];
  interpretation: ValidatedConsiderations | null;
  nextVersion: number;
};

function Interpreted({ tone, children }: { tone: "applied" | "skipped"; children: ReactNode }) {
  const applied = tone === "applied";
  return (
    <li
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${applied ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
    >
      <Badge variant={applied ? "green" : "amber"}>{applied ? "Se aplica" : "No se aplica"}</Badge>
      <div className="flex-1 text-[13px]">{children}</div>
    </li>
  );
}

/** Resumen antes de calcular: qué se aplica y qué no. Nada se ignora en silencio. */
export function ConfirmStep({ groups, omitted, interpretation, nextVersion }: ConfirmStepProps) {
  const active = groups.filter((g) => isGroupActive(g, omitted));
  const applied = interpretation?.applied ?? [];
  const notApplied = interpretation?.notApplied ?? [];
  const total = active.length + applied.length;

  return (
    <>
      <section>
        <h3 className="mb-2 text-sm font-semibold">
          Reglas de los comunicados <span className="font-normal text-muted-foreground">· {active.length}</span>
        </h3>
        <ul className="flex flex-wrap gap-1.5">
          {active.map((group) => (
            <li key={`${group.origin}-${group.title}`}>
              <Badge variant="outline" className="gap-1.5 py-1">
                <CheckIcon aria-hidden className="text-green-700" />
                {group.title}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
      {interpretation ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Tus reglas, así se interpretaron</h3>
          <ul className="flex flex-col gap-2">
            {applied.map((item) => (
              <Interpreted key={item} tone="applied">
                {item}
              </Interpreted>
            ))}
            {notApplied.map((item) => (
              <Interpreted key={`${item.text}-${item.reason}`} tone="skipped">
                «{item.text}»
                <div className="mt-0.5 text-xs text-muted-foreground">{item.reason}</div>
              </Interpreted>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-muted-foreground">
        La IA no calcula cantidades. El motor calcula con estas {total} reglas y guarda el análisis v{nextVersion}
        {nextVersion > 1 ? `; el v${nextVersion - 1} queda en el historial.` : "."}
      </p>
    </>
  );
}
