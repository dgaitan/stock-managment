"use client";

import { CheckCircle2Icon, SparklesIcon } from "lucide-react";
import { ConfirmStep } from "@/components/molecules/confirm-step";
import { ConsiderationsStep } from "@/components/molecules/considerations-step";
import { RulesStep } from "@/components/molecules/rules-step";
import { StepperProgress } from "@/components/molecules/stepper-progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCalculationStepper } from "@/hooks/use-calculation-stepper";
import { formatMonthRangeLabel } from "@/lib/engine/explain";
import { formatIsoDate } from "@/lib/format";

export function CalculateDialog() {
  const stepper = useCalculationStepper();
  const { state, pending } = stepper;
  const { step, context } = state;
  const inWizard = step === "rules" || step === "considerations" || step === "confirm";
  const activeRules = context ? context.rules.length - state.omitted.length : 0;
  const subtitle = context
    ? `Ventana ${formatMonthRangeLabel([context.window])} · llegada ${formatMonthRangeLabel([context.arrivalMonth])} · datos al ${formatIsoDate(context.cutoffDate)}`
    : "Cargando…";

  return (
    <Dialog onOpenChange={(isOpen) => (isOpen ? stepper.open() : undefined)}>
      <DialogTrigger render={<Button />}>
        <SparklesIcon data-icon="inline-start" />
        Calcular pedido
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[720px]" showCloseButton={step !== "running"}>
        <DialogHeader className="gap-0.5 px-6 pt-5 pb-4">
          <DialogTitle className="text-lg">Calcular pedido</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        {inWizard ? <StepperProgress current={step} /> : null}

        <div className="max-h-[55vh] min-h-40 overflow-auto px-6 py-5">
          {step === "rules" ? (
            context ? (
              <RulesStep rules={context.rules} omitted={state.omitted} onToggle={stepper.toggleRule} />
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                {state.error ?? "Cargando…"}
              </p>
            )
          ) : null}
          {step === "considerations" ? (
            <ConsiderationsStep text={state.text} onChange={stepper.setText} disabled={pending} />
          ) : null}
          {step === "confirm" && context ? (
            <ConfirmStep
              rules={context.rules}
              omitted={state.omitted}
              interpretation={state.interpretation}
              saveAsBulletin={state.saveAsBulletin}
              onSaveChange={stepper.setSave}
            />
          ) : null}
          {step === "running" ? (
            <div role="status" className="flex flex-col gap-3 py-8">
              <p className="text-sm font-medium">Calculando…</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          ) : null}
          {step === "done" && state.result ? (
            <div role="status" className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2Icon aria-hidden className="size-8 text-green-600" />
              <p className="font-semibold">Datos actualizados</p>
              <p className="text-sm text-muted-foreground">Análisis v{state.result.version}</p>
              {state.result.narrativeFailed ? (
                <p role="alert" className="text-xs text-destructive">
                  Sin lectura de IA esta vez.
                </p>
              ) : null}
            </div>
          ) : null}
          {state.error && step !== "rules" ? (
            <p role="alert" className="pt-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="items-center border-t bg-background px-6 py-4 sm:justify-between">
          <span className="text-[13px] text-muted-foreground">
            {step === "rules" && context ? `${activeRules} de ${context.rules.length} reglas activas` : null}
          </span>
          <div className="flex gap-2">
            {step === "done" ? <DialogClose render={<Button />}>Ver ahora</DialogClose> : null}
            {step === "rules" ? <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose> : null}
            {step === "considerations" || step === "confirm" ? (
              <Button variant="outline" onClick={stepper.back} disabled={pending}>
                Atrás
              </Button>
            ) : null}
            {step === "rules" || step === "considerations" ? (
              <Button onClick={stepper.next} disabled={pending || (step === "rules" && !context)}>
                {step === "considerations" && pending ? "Interpretando…" : step === "considerations" && !state.text.trim() ? "Omitir" : "Siguiente"}
              </Button>
            ) : null}
            {step === "confirm" ? (
              <Button onClick={stepper.calculate}>
                <SparklesIcon data-icon="inline-start" />
                Calcular pedido
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
