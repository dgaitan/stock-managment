"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { InfoTip } from "@/components/molecules/info-tip";
import { CalculationSteps } from "@/components/molecules/calculation-steps";
import { VersionMixTable } from "@/components/molecules/version-mix-table";
import { formatDecimal, formatInt, formatIsoDate, formatTimestamp } from "@/lib/format";
import type { OrderLineView, OrderRunView } from "@/lib/orders/types";

type WhySheetProps = {
  line: OrderLineView;
  run: Pick<OrderRunView, "version" | "createdAt" | "cutoffDate">;
};

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-lg border p-3">
      <div className="text-xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function WhySheet({ line, run }: WhySheetProps) {
  const { plan, versionMix, versionMixWindowMonths } = line.detail;

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="sm" />}>Ver por qué</SheetTrigger>
      <SheetContent className="data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="flex items-center gap-1.5 text-lg">
            ¿Por qué {formatInt(line.orderUnits)} unidades de {line.modelName}?
                      <InfoTip label="Resumen del motor">{line.explanation}</InfoTip>
          </SheetTitle>
          <SheetDescription>
            Análisis v{run.version} · {formatTimestamp(run.createdAt)} · datos al {formatIsoDate(run.cutoffDate)}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-auto px-6 pb-6">
          {plan.imputedStockoutMonths > 0 ? (
            <div className="flex gap-1.5">
              <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-900">Demanda oculta por quiebre</Badge>
              <Badge variant="outline">{plan.imputedStockoutMonths} meses imputados</Badge>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Stat value={formatInt(plan.patioAtCutoff)} label="en patio al corte" />
            <Stat value={formatInt(plan.transitoAtCutoff)} label="en tránsito" />
            <Stat value={formatDecimal(plan.forecastMonthlyRate)} label="demanda corregida / mes" />
          </div>
          <CalculationSteps detail={line.detail} capital={line.capital} />
          {line.orderUnits > 0 && versionMix.length > 0 ? (
            <VersionMixTable rows={versionMix} windowLabel={`los últimos ${versionMixWindowMonths} meses`} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
