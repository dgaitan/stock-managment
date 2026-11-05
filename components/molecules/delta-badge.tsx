import { formatInt } from "@/lib/format";
import { lineChanged } from "@/lib/orders/runSummary";

/** Cambio de unidades contra el análisis anterior (p. ej. «+24»). No se muestra si no cambió. */
export function DeltaBadge({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || !lineChanged({ orderUnits: current, previousOrderUnits: previous })) return null;
  const delta = current - previous;
  return (
    <span
      className="rounded-[4px] bg-blue-100 px-1.5 py-px text-xs font-semibold text-blue-900"
      title={`Antes: ${formatInt(previous)}`}
    >
      {delta > 0 ? "+" : "−"}
      {formatInt(Math.abs(delta))}
    </span>
  );
}
