import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type InfoTipProps = {
  label: string; // nombre accesible del botón
  children: ReactNode; // texto del tooltip: dos frases como máximo
};

/** Ícono ⓘ con la explicación larga en un tooltip, para no llenar la pantalla de texto. */
export function InfoTip({ label, children }: InfoTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <InfoIcon aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-pretty">{children}</TooltipContent>
    </Tooltip>
  );
}
