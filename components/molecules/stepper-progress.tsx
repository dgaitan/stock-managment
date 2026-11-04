import type { Step } from "@/hooks/use-calculation-stepper";

const STEPS: { id: Step; label: string }[] = [
  { id: "rules", label: "Comunicados y reglas" },
  { id: "considerations", label: "Reglas adicionales" },
  { id: "confirm", label: "Confirmar" },
];

/** Indicador de los 3 pasos; el activo va en negrita y los anteriores quedan marcados. */
export function StepperProgress({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-3 text-xs" aria-label="Pasos del cálculo">
      {STEPS.map((step, index) => (
        <li key={step.id} className="flex items-center gap-1.5" aria-current={index === currentIndex ? "step" : undefined}>
          <span
            className={
              index <= currentIndex
                ? "flex size-5 items-center justify-center rounded-full bg-primary text-[0.7rem] text-primary-foreground"
                : "flex size-5 items-center justify-center rounded-full border text-[0.7rem] text-muted-foreground"
            }
          >
            {index + 1}
          </span>
          <span className={index === currentIndex ? "font-semibold" : "text-muted-foreground"}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
