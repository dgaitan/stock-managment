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

export function CalculateDialog() {
  const stepper = useCalculationStepper();
  const { state, pending } = stepper;
  const { step, context } = state;
  const omittedRules = context?.rules.filter((r) => state.omitted.includes(r.id)) ?? [];
  const inWizard = step === "rules" || step === "considerations" || step === "confirm";

  return (
    <Dialog onOpenChange={(isOpen) => (isOpen ? stepper.open() : undefined)}>
      <DialogTrigger render={<Button />}>
        <SparklesIcon data-icon="inline-start" />
        Calcular pedido
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl" showCloseButton={step !== "running"}>
        <DialogHeader>
          <DialogTitle>Calcular pedido</DialogTitle>
          <DialogDescription>
            Las reglas y consideraciones se aplican solo a este cálculo. El motor calcula; la IA nunca decide cantidades.
          </DialogDescription>
        </DialogHeader>
        {inWizard ? <StepperProgress current={step} /> : null}

        <div className="max-h-[50vh] overflow-auto py-1">
          {step === "rules" ? (
            context ? (
              <RulesStep rules={context.rules} omitted={state.omitted} onToggle={stepper.toggleRule} />
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                {state.error ?? "Cargando reglas vigentes…"}
              </p>
            )
          ) : null}
          {step === "considerations" ? (
            <ConsiderationsStep text={state.text} onChange={stepper.setText} disabled={pending} />
          ) : null}
          {step === "confirm" ? (
            <ConfirmStep
              omittedRules={omittedRules}
              interpretation={state.interpretation}
              saveAsBulletin={state.saveAsBulletin}
              onSaveChange={stepper.setSave}
            />
          ) : null}
          {step === "running" ? (
            <div role="status" className="flex flex-col gap-3 py-6">
              <p className="text-sm font-medium">Calculando…</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                Calculando el pedido por modelo y redactando el análisis. Puede tardar unos segundos.
              </p>
            </div>
          ) : null}
          {step === "done" && state.result ? (
            <div role="status" className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2Icon aria-hidden className="size-8 text-primary" />
              <p className="font-semibold">Datos actualizados</p>
              <p className="text-sm text-muted-foreground">Análisis v{state.result.version} guardado.</p>
              {state.result.narrativeFailed ? (
                <p role="alert" className="text-xs text-destructive">
                  El pedido se guardó, pero no se pudo redactar el análisis con IA.
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

        <DialogFooter>
          {step === "done" ? <DialogClose render={<Button />}>Ver ahora</DialogClose> : null}
          {inWizard && step !== "rules" ? (
            <Button variant="outline" onClick={stepper.back} disabled={pending}>
              Atrás
            </Button>
          ) : null}
          {step === "rules" || step === "considerations" ? (
            <Button onClick={stepper.next} disabled={pending || (step === "rules" && !context)}>
              {step === "considerations" ? (pending ? "Interpretando…" : state.text.trim() ? "Siguiente" : "Omitir") : "Siguiente"}
            </Button>
          ) : null}
          {step === "confirm" ? <Button onClick={stepper.calculate}>Calcular</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
