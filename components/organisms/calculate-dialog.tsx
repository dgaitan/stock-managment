"use client";

import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { CalculationDone } from "@/components/molecules/calculation-done";
import { CalculationRunning } from "@/components/molecules/calculation-running";
import { ConfirmStep } from "@/components/molecules/confirm-step";
import { ConsiderationsStep } from "@/components/molecules/considerations-step";
import { RulesStep } from "@/components/molecules/rules-step";
import { StepperProgress } from "@/components/molecules/stepper-progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useBulletinsDrawer } from "@/hooks/use-bulletins-drawer";
import { useCalculationStepper } from "@/hooks/use-calculation-stepper";
import { monthLabelWithYear } from "@/lib/engine/explain";
import { formatShortDate, formatWindow } from "@/lib/format";
import { groupRulesByBulletin, isGroupActive } from "@/lib/orders/ruleGroups";
import type { RunSummary } from "@/lib/orders/types";

const Sparkles = () => <SparklesIcon data-icon="inline-start" />;

/** Stepper «Calcular pedido». `latest` es el análisis vigente: al terminar ya trae el recién calculado. */
export function CalculateDialog({ latest }: { latest: RunSummary | null }) {
  const [open, setOpen] = useState(false);
  const bulletins = useBulletinsDrawer();
  const stepper = useCalculationStepper();
  const { state, pending } = stepper;
  const { step, context } = state;
  const groups = context ? groupRulesByBulletin(context.rules) : [];
  const activeGroups = groups.filter((g) => isGroupActive(g, state.omitted));
  const userRules = state.interpretation?.applied.length ?? 0;
  const subtitle = context
    ? `Ventana ${formatWindow(context.window)} · llegada ${monthLabelWithYear(context.arrivalMonth)} · datos al ${formatShortDate(context.cutoffDate)}`
    : "Cargando…";

  const onOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) stepper.open();
  };
  const manageBulletins = () => {
    setOpen(false);
    bulletins.setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Sparkles />
        Calcular pedido
      </DialogTrigger>
      <DialogContent className="sm:max-w-[720px]" showCloseButton={step !== "running"}>
        <DialogHeader>
          <DialogTitle>Calcular pedido</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <StepperProgress current={step} />

        <DialogBody>
          {step === "rules" ? (
            context ? (
              <RulesStep groups={groups} omitted={state.omitted} onToggle={stepper.toggleRules} onManageBulletins={manageBulletins} />
            ) : (
              <p role="status" className="text-[13px] text-muted-foreground">
                {state.error ?? "Cargando…"}
              </p>
            )
          ) : null}
          {step === "considerations" ? (
            <ConsiderationsStep
              text={state.text}
              onChange={stepper.setText}
              saveAsBulletin={state.saveAsBulletin}
              onSaveChange={stepper.setSave}
              disabled={pending}
            />
          ) : null}
          {step === "confirm" ? (
            <ConfirmStep
              groups={groups}
              omitted={state.omitted}
              interpretation={state.interpretation}
              nextVersion={(latest?.version ?? 0) + 1}
            />
          ) : null}
          {step === "running" && context ? (
            <CalculationRunning
              models={context.models.length}
              cutoffDate={context.cutoffDate}
              rules={activeGroups.length + userRules}
              withNarrative={context.aiEnabled}
            />
          ) : null}
          {step === "done" && state.result ? <CalculationDone version={state.result.version} summary={latest} /> : null}
          {state.error && step !== "rules" ? (
            <p role="alert" className="text-[13px] text-destructive">
              {state.error}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          {step === "rules" ? (
            <>
              <span className="text-[13px] text-muted-foreground">
                {context ? `${activeGroups.length} de ${groups.length} reglas activas` : null}
              </span>
              <div className="flex gap-2">
                <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
                <Button onClick={stepper.next} disabled={pending || !context}>
                  Siguiente
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </div>
            </>
          ) : null}
          {step === "considerations" ? (
            <>
              <Button variant="outline" onClick={stepper.back} disabled={pending}>
                Atrás
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={stepper.skip} disabled={pending}>
                  Omitir
                </Button>
                <Button onClick={stepper.next} disabled={pending || !state.text.trim()}>
                  <Sparkles />
                  {pending ? "Interpretando…" : "Interpretar y continuar"}
                </Button>
              </div>
            </>
          ) : null}
          {step === "confirm" ? (
            <>
              <Button variant="outline" onClick={stepper.back}>
                Atrás
              </Button>
              <Button onClick={stepper.calculate}>
                <Sparkles />
                Calcular pedido
              </Button>
            </>
          ) : null}
          {step === "running" ? (
            <>
              <span />
              <Button variant="outline" disabled>
                Calculando…
              </Button>
            </>
          ) : null}
          {step === "done" ? (
            <>
              <span className="text-xs text-muted-foreground">
                {state.result?.narrativeFailed ? "Sin lectura de IA esta vez." : null}
              </span>
              <DialogClose render={<Button />}>
                Ver ahora
                <ArrowRightIcon data-icon="inline-end" />
              </DialogClose>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
