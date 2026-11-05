import { CheckIcon } from "lucide-react";
import { formatInt, formatUsdMillions } from "@/lib/format";
import type { RunSummary } from "@/lib/orders/types";

function describeChanges(changes: RunSummary["changes"]): string {
  if (changes.length === 0) return "Ningún modelo cambió.";
  const list = changes.map((c) => `${c.model} ${c.delta > 0 ? "+" : "−"}${formatInt(Math.abs(c.delta))} u.`).join(", ");
  return `Cambió ${changes.length} ${changes.length === 1 ? "modelo" : "modelos"} (${list}).`;
}

/** Listo: el nuevo análisis ya es el pedido sugerido. */
export function CalculationDone({ version, summary }: { version: number; summary: RunSummary | null }) {
  const current = summary?.version === version ? summary : null;
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-7">
      <span className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700">
        <CheckIcon aria-hidden className="size-7" />
      </span>
      <div className="text-center">
        <h3 className="text-lg font-semibold">Datos actualizados</h3>
        <p className="mt-1.5 max-w-[440px] text-[13px] text-muted-foreground">
          El pedido sugerido ahora es el <b className="text-foreground">análisis v{version}</b>
          {current
            ? `: ${formatInt(current.totalUnits)} unidades · ${formatUsdMillions(current.totalCapital)}. ${describeChanges(current.changes)}`
            : "."}
        </p>
      </div>
    </div>
  );
}
