"use client";

import { useState, useTransition } from "react";
import { confirmImportAction, previewImportAction } from "@/lib/import/actions";
import type { ImportPreviewView } from "@/lib/import/types";

type State = {
  file: File | null;
  preview: ImportPreviewView | null;
  error: string | null;
  done: { noop: boolean } | null;
};

const EMPTY: State = { file: null, preview: null, error: null, done: null };

function toFormData(file: File): FormData {
  const data = new FormData();
  data.set("file", file);
  return data;
}

/** Subir → revisar qué cambia → confirmar. El archivo se reenvía al confirmar (sin estado en el servidor). */
export function useImportSheet() {
  const [state, setState] = useState<State>(EMPTY);
  const [pending, startTransition] = useTransition();

  const reset = () => setState(EMPTY);

  const choose = (file: File) => {
    setState({ ...EMPTY, file });
    startTransition(async () => {
      try {
        const result = await previewImportAction(toFormData(file));
        setState(result.ok ? { ...EMPTY, file, preview: result.data } : { ...EMPTY, file, error: result.error });
      } catch {
        setState({ ...EMPTY, file, error: "No se pudo revisar el archivo." });
      }
    });
  };

  const confirm = () => {
    const { file } = state;
    if (!file) return;
    startTransition(async () => {
      try {
        const result = await confirmImportAction(toFormData(file));
        setState((s) => (result.ok ? { ...s, error: null, done: result.data } : { ...s, error: result.error }));
      } catch {
        setState((s) => ({ ...s, error: "No se pudo importar el archivo." }));
      }
    });
  };

  return { state, pending, choose, confirm, reset };
}
