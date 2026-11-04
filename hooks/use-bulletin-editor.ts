"use client";

import { useState, useTransition } from "react";
import { archiveBulletinAction, previewRulesAction, saveBulletinAction, saveRulesAction } from "@/lib/bulletins/actions";
import type { BulletinInput } from "@/lib/bulletins/schemas";
import type { BulletinDraft, BulletinView, RulesPreview } from "@/lib/bulletins/types";

export function draftFrom(bulletin: BulletinView | null, today: string): BulletinDraft {
  return bulletin
    ? {
        id: bulletin.id,
        date: bulletin.date,
        issuer: bulletin.issuer ?? "",
        subject: bulletin.subject,
        body: bulletin.body,
        scope: bulletin.scope,
        cycle: bulletin.cycle ?? "",
      }
    : { id: null, date: today, issuer: "", subject: "", body: "", scope: "permanent", cycle: "" };
}

function toInput(draft: BulletinDraft): BulletinInput {
  return {
    id: draft.id,
    date: draft.date,
    issuer: draft.issuer.trim() || null,
    subject: draft.subject,
    body: draft.body,
    scope: draft.scope,
    cycle: draft.scope === "cycle" ? draft.cycle.trim() || null : null,
  };
}

/** Estado y acciones del editor de un comunicado: guardar, extraer reglas con IA y confirmarlas. */
export function useBulletinEditor(initial: BulletinDraft, onSaved: (id: number) => void) {
  const [draft, setDraft] = useState(initial);
  const [preview, setPreview] = useState<RulesPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(patch: Partial<BulletinDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setMessage(null);
  }

  function fail(text: string) {
    setError(text);
    setMessage(null);
  }

  function run(task: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
      } catch {
        fail("Algo falló. Intenta de nuevo.");
      }
    });
  }

  const save = () =>
    run(async () => {
      const result = await saveBulletinAction(toInput(draft));
      if (!result.ok) return fail(result.error);
      setDraft((d) => ({ ...d, id: result.data.id }));
      setPreview(null);
      setMessage(
        result.data.rulesCleared ? "Guardado. Cambió la vigencia: extrae de nuevo las reglas." : "Comunicado guardado.",
      );
      onSaved(result.data.id);
    });

  const extract = () =>
    run(async () => {
      if (draft.id === null) return fail("Guarda el comunicado antes de extraer sus reglas.");
      const result = await previewRulesAction(draft.id);
      if (!result.ok) return fail(result.error);
      setPreview(result.data);
    });

  const confirmRules = () =>
    run(async () => {
      if (draft.id === null || !preview) return;
      const rules = preview.rules.map(({ model, key, value }) => ({ model, key, value }));
      const result = await saveRulesAction({ bulletinId: draft.id, rules });
      if (!result.ok) return fail(result.error);
      setPreview(null);
      setMessage(`${result.data.saved} reglas guardadas.`);
    });

  const archive = (archived: boolean, afterwards: () => void) =>
    run(async () => {
      if (draft.id === null) return;
      const result = await archiveBulletinAction(draft.id, archived);
      if (!result.ok) return fail(result.error);
      afterwards();
    });

  return {
    draft,
    change,
    preview,
    discardPreview: () => setPreview(null),
    message,
    error,
    pending,
    save,
    extract,
    confirmRules,
    archive,
  };
}
