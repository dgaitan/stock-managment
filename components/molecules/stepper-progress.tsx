import { CheckIcon } from "lucide-react";
import type { Step } from "@/hooks/use-calculation-stepper";

const STEPS: { id: Step; label: string }[] = [
  { id: "rules", label: "Comunicados y reglas" },
  { id: "considerations", label: "Reglas adicionales" },
  { id: "confirm", label: "Confirmar y calcular" },
];

// «running» sigue en el paso 3; «done» marca los tres como completos.
const INDEX: Record<Step, number> = { rules: 0, considerations: 1, confirm: 2, running: 2, done: 3 };

/** Los 3 pasos: el actual en azul, los anteriores con ✓ verde. */
export function StepperProgress({ current }: { current: Step }) {
  const currentIndex = INDEX[current];
  return (
    <ol className="flex items-center gap-3 border-b border-border bg-subtle px-6 py-3.5" aria-label="Pasos">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="contents">
            {index > 0 ? <span aria-hidden className="h-px min-w-4 flex-1 bg-zinc-300" /> : null}
            <span
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 text-[13px] whitespace-nowrap ${active ? "font-semibold text-foreground" : "font-medium text-zinc-600"}`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full border text-xs font-semibold ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-green-300 bg-green-100 text-green-900"
                      : "border-zinc-300 bg-background text-zinc-600"
                }`}
              >
                {done ? <CheckIcon aria-hidden className="size-[13px]" /> : index + 1}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
