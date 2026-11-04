import { Badge } from "@/components/ui/badge";
import type { OrderReason, ReasonBadge } from "@/lib/engine/reason";

const BADGES: Record<ReasonBadge, { label: string; variant: "destructive" | "outline" | "secondary" }> = {
  quiebre: { label: "Quiebre", variant: "destructive" },
  antiguedad: { label: "Antigüedad", variant: "outline" },
  fin_generacion: { label: "Fin de generación", variant: "secondary" },
};

export function ReasonCell({ reason }: { reason: OrderReason }) {
  const badge = reason.badge ? BADGES[reason.badge] : null;
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
      {reason.text}
    </span>
  );
}
