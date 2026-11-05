"use client";

import { useState, useTransition } from "react";
import { confirmImportAction, previewImportAction } from "@/lib/import/actions";
import type { ImportMode } from "@/lib/import/diff";
import type { ImportPreviewView } from "@/lib/import/types";

type State = {
  file: File | null;
  preview: ImportPreviewView | null;
  error: string | null;
  done: { noop: boolean } | null;
  acceptedWarnings: boolean; // el usuario aceptó importar con advertencias
  replace: boolean; // «Reemplazar datos»: marcado por defecto
};

const EMPTY: State = { file: null, preview: null, error: null, done: null, acceptedWarnings: false, replace: true };

const modeOf = (replace: boolean): ImportMode => (replace ? "replace" : "merge");

function toFormData(file: File, mode: ImportMode, acceptWarnings = false): FormData {
  const data = new FormData();
  data.set("file", file);
  data.set("mode", mode);
  if (acceptWarnings) data.set("acceptWarnings", "true");
  return data;
}

/**
 * Subir → revisar qué cambia → confirmar. El archivo se reenvía al confirmar (sin
 * estado en el servidor). Cambiar «Reemplazar datos» vuelve a calcular la vista
 * previa, porque cambia qué filas se eliminan y qué advertencias hay.
 */
export function useImportSheet() {
  const [state, setState] = useState<State>(EMPTY);
  const [pending, startTransition] = useTransition();

  const reset = () => setState(EMPTY);

  const preview = (file: File, replace: boolean) => {
    setState({ ...EMPTY, file, replace });
    startTransition(async () => {
      try {
        const result = await previewImportAction(toFormData(file, modeOf(replace)));
        setState(result.ok ? { ...EMPTY, file, replace, preview: result.data } : { ...EMPTY, file, replace, error: result.error });
      } catch {
        setState({ ...EMPTY, file, replace, error: "No se pudo revisar el archivo." });
      }
    });
  };

  const choose = (file: File) => preview(file, state.replace);

  const setReplace = (replace: boolean) => {
    if (state.file) preview(state.file, replace);
    else setState((s) => ({ ...s, replace }));
  };

  const confirm = () => {
    const { file, acceptedWarnings, replace } = state;
    if (!file) return;
    startTransition(async () => {
      try {
        const result = await confirmImportAction(toFormData(file, modeOf(replace), acceptedWarnings));
        setState((s) => (result.ok ? { ...s, error: null, done: result.data } : { ...s, error: result.error }));
      } catch {
        setState((s) => ({ ...s, error: "No se pudo importar el archivo." }));
      }
    });
  };

  const acceptWarnings = (accepted: boolean) => setState((s) => ({ ...s, acceptedWarnings: accepted }));

  return { state, pending, choose, confirm, reset, acceptWarnings, setReplace };
}
