import { formatInt } from "@/lib/format";

/** Cambio de unidades contra el análisis anterior (p. ej. «+24»). No se muestra si no cambió. */
export function DeltaBadge({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === current) return null;
  const delta = current - previous;
  return (
    <span className="text-xs font-medium text-muted-foreground" title={`Antes: ${formatInt(previous)}`}>
      {delta > 0 ? "+" : "−"}
      {formatInt(Math.abs(delta))}
    </span>
  );
}
