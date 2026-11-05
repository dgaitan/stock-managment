import { CheckIcon } from "lucide-react";
import type { Step } from "@/hooks/use-calculation-stepper";

const STEPS: { id: Step; label: string }[] = [
  { id: "rules", label: "Comunicados y reglas" },
  { id: "considerations", label: "Reglas adicionales" },
  { id: "confirm", label: "Confirmar y calcular" },
];

/** Los 3 pasos: el actual en azul, los anteriores con ✓ verde. */
export function StepperProgress({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-3 border-y bg-muted/40 px-6 py-3.5 text-[13px]" aria-label="Pasos del cálculo">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="contents" aria-current={active ? "step" : undefined}>
            {index > 0 ? <span aria-hidden className="h-px min-w-4 flex-1 bg-border" /> : null}
            <span className={`flex items-center gap-2 whitespace-nowrap ${active ? "font-semibold" : "font-medium text-muted-foreground"}`}>
              <span
                className={`flex size-6 items-center justify-center rounded-full border text-xs font-semibold ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-green-300 bg-green-100 text-green-900"
                      : "bg-background"
                }`}
              >
                {done ? <CheckIcon aria-hidden className="size-3.5" /> : index + 1}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
