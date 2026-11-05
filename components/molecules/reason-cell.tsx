import { Badge } from "@/components/ui/badge";
import { REASON_BADGE_LABELS, type OrderReason, type ReasonBadge } from "@/lib/engine/reason";
import { demandFactorLabel } from "@/lib/orders/runSummary";

const BADGE_VARIANTS: Record<ReasonBadge, "red" | "orange" | "secondary"> = {
  quiebre: "red",
  antiguedad: "orange",
  fin_generacion: "secondary",
};

/** Insignia solo en excepciones (o la regla del planificador, en azul) y el motivo en una línea. */
export function ReasonCell({ reason, demandFactor }: { reason: OrderReason; demandFactor: number | null }) {
  const badge = reason.badge ? { label: REASON_BADGE_LABELS[reason.badge], variant: BADGE_VARIANTS[reason.badge] } : null;
  return (
    <span className="flex items-center gap-2 text-[13px] text-zinc-600">
      {demandFactor !== null ? (
        <Badge variant="blue">{demandFactorLabel(demandFactor)}</Badge>
      ) : badge ? (
        <Badge variant={badge.variant}>{badge.label}</Badge>
      ) : null}
      {reason.text}
    </span>
  );
}
