import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { OrderReason, ReasonBadge } from "@/lib/engine/reason";

const BADGES: Record<ReasonBadge, { label: string; className: string }> = {
  quiebre: { label: "Quiebre", className: "border-red-200 bg-red-100 text-red-900" },
  antiguedad: { label: ">180 días", className: "border-orange-200 bg-orange-100 text-orange-900" },
  fin_generacion: { label: "Fin de generación", className: "border-zinc-200 bg-zinc-100 text-zinc-700" },
};

/** Insignia solo en excepciones y el motivo en una línea; el texto completo va en el tooltip. */
export function ReasonCell({ reason }: { reason: OrderReason }) {
  const badge = reason.badge ? BADGES[reason.badge] : null;
  return (
    <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
      {badge ? (
        <Badge variant="outline" className={badge.className}>
          {badge.label}
        </Badge>
      ) : null}
      <Tooltip>
        <TooltipTrigger render={<span className="max-w-72 truncate" />}>{reason.text}</TooltipTrigger>
        <TooltipContent>{reason.text}</TooltipContent>
      </Tooltip>
    </span>
  );
}
