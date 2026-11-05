import { CheckIcon, CircleIcon, LoaderCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatShortDate } from "@/lib/format";

type ProgressItem = { label: string; state: "done" | "active" | "pending" };

const ICON: Record<ProgressItem["state"], ReactNode> = {
  done: <CheckIcon aria-hidden className="size-4 text-green-700" />,
  active: <LoaderCircleIcon aria-hidden className="size-4 animate-spin text-primary" />,
  pending: <CircleIcon aria-hidden className="size-4 text-zinc-400" />,
};

/** Calculando: los datos y las reglas ya están listos; el motor calcula y, con IA, redacta el porqué. */
export function CalculationRunning({ models, cutoffDate, rules, withNarrative }: {
  models: number;
  cutoffDate: string;
  rules: number;
  withNarrative: boolean;
}) {
  const items: ProgressItem[] = [
    { label: `Datos al ${formatShortDate(cutoffDate)} cargados`, state: "done" },
    { label: `${rules} reglas aplicadas`, state: "done" },
    { label: "Calculando pedido por modelo", state: "active" },
    ...(withNarrative ? [{ label: "Redactando el porqué de cada modelo", state: "pending" as const }] : []),
  ];
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-5 py-6">
      <LoaderCircleIcon aria-hidden className="size-10 animate-spin text-primary" />
      <div className="text-center">
        <h3 className="text-base font-semibold">Calculando el pedido de {models} modelos…</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">Esto toma unos segundos.</p>
      </div>
      <ul className="flex w-[360px] flex-col gap-2.5">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-2.5 text-[13px] ${item.state === "active" ? "font-medium" : ""} ${item.state === "pending" ? "text-muted-foreground" : ""}`}
          >
            {ICON[item.state]}
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
