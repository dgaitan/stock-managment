"use client";

import { useReducer, useTransition } from "react";
import type { ValidatedConsiderations } from "@/lib/ai/considerations";
import { calculateOrderAction, interpretConsiderationsAction, loadCalculationContextAction } from "@/lib/orders/actions";
import type { CalculationRequest } from "@/lib/orders/request";
import { allOmitted } from "@/lib/orders/ruleGroups";
import type { CalculationContext } from "@/lib/orders/types";

export type Step = "rules" | "considerations" | "confirm" | "running" | "done";

export type StepperState = {
  step: Step;
  context: CalculationContext | null;
  omitted: number[]; // ids de reglas omitidas solo en este cálculo
  text: string;
  interpretation: ValidatedConsiderations | null;
  saveAsBulletin: boolean;
  result: { version: number; narrativeFailed: boolean } | null;
  error: string | null;
};

type Action =
  | { type: "reset" }
  | { type: "loaded"; context: CalculationContext }
  | { type: "toggleRules"; ids: number[] }
  | { type: "setText"; text: string }
  | { type: "setSave"; value: boolean }
  | { type: "goto"; step: Step }
  | { type: "interpreted"; interpretation: ValidatedConsiderations | null }
  | { type: "done"; result: NonNullable<StepperState["result"]> }
  | { type: "failed"; error: string; step: Step };

const INITIAL: StepperState = {
  step: "rules",
  context: null,
  omitted: [],
  text: "",
  interpretation: null,
  saveAsBulletin: false,
  result: null,
  error: null,
};

function reducer(state: StepperState, action: Action): StepperState {
  switch (action.type) {
    case "reset":
      return INITIAL;
    case "loaded":
      return { ...state, context: action.context, error: null };
    case "toggleRules": {
      // Un comunicado se activa o se excluye completo: si todas sus reglas estaban omitidas, vuelven; si no, se omiten.
      const rest = state.omitted.filter((id) => !action.ids.includes(id));
      return { ...state, omitted: allOmitted(action.ids, state.omitted) ? rest : [...rest, ...action.ids] };
    }
    case "setText":
      // Si cambia el texto, la interpretación mostrada ya no le corresponde.
      return { ...state, text: action.text, interpretation: null };
    case "setSave":
      return { ...state, saveAsBulletin: action.value };
    case "goto":
      return { ...state, step: action.step, error: null };
    case "interpreted":
      return { ...state, step: "confirm", interpretation: action.interpretation, error: null };
    case "done":
      return { ...state, step: "done", result: action.result, error: null };
    case "failed":
      return { ...state, step: action.step, error: action.error };
  }
}

function toRequest(state: StepperState): CalculationRequest {
  const { interpretation, text } = state;
  return {
    excludedRuleIds: state.omitted,
    considerations: interpretation
      ? {
          text,
          demandFactors: interpretation.adjustments.demandFactors.map((f) => ({
            model: f.model,
            factor: f.factor,
            months: f.months ?? null,
          })),
          excludedModels: interpretation.adjustments.excludedModels,
        }
      : null,
    saveAsBulletin: interpretation !== null && state.saveAsBulletin,
  };
}

/** Pasos del diálogo «Calcular pedido»: reglas → reglas adicionales → confirmar → calcular. */
export function useCalculationStepper() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [pending, startTransition] = useTransition();

  function guard(step: Step, task: () => Promise<void>) {
    startTransition(async () => {
      try {
        await task();
      } catch {
        dispatch({ type: "failed", error: "Algo falló. Intenta de nuevo.", step });
      }
    });
  }

  const open = () => {
    dispatch({ type: "reset" });
    guard("rules", async () => {
      const result = await loadCalculationContextAction();
      if (result.ok) dispatch({ type: "loaded", context: result.data });
      else dispatch({ type: "failed", error: result.error, step: "rules" });
    });
  };

  const next = () => {
    if (state.step === "rules") {
      dispatch({ type: "goto", step: state.context?.aiEnabled ? "considerations" : "confirm" });
      return;
    }
    if (state.step !== "considerations") return;
    if (!state.text.trim()) {
      dispatch({ type: "interpreted", interpretation: null });
      return;
    }
    guard("considerations", async () => {
      const result = await interpretConsiderationsAction(state.text);
      if (result.ok) dispatch({ type: "interpreted", interpretation: result.data });
      else dispatch({ type: "failed", error: result.error, step: "considerations" });
    });
  };

  /** «Omitir»: sigue sin reglas adicionales aunque haya texto escrito. */
  const skip = () => dispatch({ type: "interpreted", interpretation: null });

  const back = () => {
    if (state.step === "confirm") dispatch({ type: "goto", step: state.context?.aiEnabled ? "considerations" : "rules" });
    else if (state.step === "considerations") dispatch({ type: "goto", step: "rules" });
  };

  const calculate = () => {
    const request = toRequest(state);
    dispatch({ type: "goto", step: "running" });
    guard("confirm", async () => {
      const result = await calculateOrderAction(request);
      if (result.ok) dispatch({ type: "done", result: result.data });
      else dispatch({ type: "failed", error: result.error, step: "confirm" });
    });
  };

  return {
    state,
    pending,
    open,
    next,
    skip,
    back,
    calculate,
    toggleRules: (ids: number[]) => dispatch({ type: "toggleRules", ids }),
    setText: (text: string) => dispatch({ type: "setText", text }),
    setSave: (value: boolean) => dispatch({ type: "setSave", value }),
  };
}
