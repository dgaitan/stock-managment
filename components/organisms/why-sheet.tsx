"use client";

import { AiReadingCard } from "@/components/molecules/ai-reading-card";
import { CalculationSteps } from "@/components/molecules/calculation-steps";
import { VersionMixTable } from "@/components/molecules/version-mix-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { explainLead, monthLabel } from "@/lib/engine/explain";
import { formatDecimal, formatInt, formatShortDate, formatTimestamp } from "@/lib/format";
import { alertsForModel } from "@/lib/orders/narrativeText";
import type { OrderLineView, OrderRunView } from "@/lib/orders/types";

type WhySheetProps = {
  line: OrderLineView;
  run: Pick<OrderRunView, "version" | "createdAt" | "cutoffDate" | "narrative">;
  modelNames: string[]; // todos los modelos del análisis (para atribuir las alertas de la IA)
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[10px] border border-border px-3.5 py-3">
      <div className="text-xl font-bold tracking-[-0.02em]">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function WhySheet({ line, run, modelNames }: WhySheetProps) {
  const { plan, versionMix, versionMixWindowMonths } = line.detail;
  const alerts = alertsForModel(run.narrative, line.modelName, modelNames);

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="sm" />}>Ver por qué</SheetTrigger>
      <SheetContent className="sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>
            ¿Por qué {formatInt(line.orderUnits)} unidades de {line.modelName}?
          </SheetTitle>
          <SheetDescription>
            Análisis v{run.version} · {formatTimestamp(run.createdAt)} · datos al {formatShortDate(run.cutoffDate)}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {plan.imputedStockoutMonths > 0 ? (
            <div className="flex items-center gap-1.5">
              <Badge variant="amber">Demanda oculta por falta de stock</Badge>
              <Badge variant="outline">{plan.imputedStockoutMonths} meses imputados</Badge>
            </div>
          ) : null}
          <p className="text-sm leading-[1.6]">{explainLead(plan)}</p>
          <div className="flex gap-2">
            <Stat value={formatInt(plan.patioAtCutoff)} label="en patio al corte" />
            <Stat value={formatInt(plan.transitoAtCutoff)} label="en tránsito" />
            <Stat value={formatInt(Math.round(plan.projectedStockAtArrival))} label={`stock a ${monthLabel(plan.arrivalMonth)}`} />
          </div>
          <div className="flex items-center justify-between rounded-[10px] border border-border bg-subtle px-4 py-3.5">
            <span>Demanda corregida estimada</span>
            <strong className="text-lg">{formatDecimal(plan.forecastMonthlyRate)} unidades / mes</strong>
          </div>
          <CalculationSteps detail={line.detail} capital={line.capital} />
          {line.orderUnits > 0 && versionMix.length > 0 ? (
            <VersionMixTable rows={versionMix} windowMonths={versionMixWindowMonths} />
          ) : null}
          {alerts.length > 0 ? <AiReadingCard lines={alerts} /> : null}
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Cerrar</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
