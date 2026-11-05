"use client";

import { ArchiveIcon, ArchiveRestoreIcon, ArrowLeftIcon, SparklesIcon } from "lucide-react";
import { BulletinForm } from "@/components/molecules/bulletin-form";
import { RulesPreviewList } from "@/components/molecules/rules-preview";
import { InfoTip } from "@/components/molecules/info-tip";
import { Button } from "@/components/ui/button";
import { draftFrom, useBulletinEditor } from "@/hooks/use-bulletin-editor";
import { ruleKeyLabel, ruleValueLabel } from "@/lib/bulletins/labels";
import type { BulletinView } from "@/lib/bulletins/types";

type BulletinEditorProps = {
  bulletin: BulletinView | null; // null = comunicado nuevo
  today: string;
  aiEnabled: boolean;
  onBack: () => void;
  onSaved: (id: number) => void;
};

export function BulletinEditor({ bulletin, today, aiEnabled, onBack, onSaved }: BulletinEditorProps) {
  const editor = useBulletinEditor(draftFrom(bulletin, today), onSaved);
  const { draft } = editor;
  const savedId = draft.id;
  const rules = bulletin?.rules ?? [];

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-auto px-6 py-5">
      <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
        <ArrowLeftIcon data-icon="inline-start" />
        Comunicados
      </Button>

      <BulletinForm
        draft={draft}
        onChange={editor.change}
        identityLocked={bulletin?.source === "excel"}
        disabled={editor.pending}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={editor.save} disabled={editor.pending}>
          Guardar
        </Button>
        {bulletin ? (
          <Button
            variant="outline"
            disabled={editor.pending}
            onClick={() => editor.archive(!bulletin.archived, onBack)}
          >
            {bulletin.archived ? <ArchiveRestoreIcon data-icon="inline-start" /> : <ArchiveIcon data-icon="inline-start" />}
            {bulletin.archived ? "Restaurar" : "Archivar"}
          </Button>
        ) : null}
      </div>
      {editor.message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {editor.message}
        </p>
      ) : null}
      {editor.error ? (
        <p role="alert" className="text-sm text-destructive">
          {editor.error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 border-t pt-5" aria-label="Reglas del comunicado">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1 text-sm font-semibold">
            Reglas del comunicado
            <InfoTip label="Qué son">Las reglas que el motor toma de este comunicado.</InfoTip>
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={editor.extract}
            disabled={editor.pending || !aiEnabled || savedId === null}
            title={aiEnabled ? undefined : "Requiere ANTHROPIC_API_KEY"}
          >
            <SparklesIcon data-icon="inline-start" />
            Extraer con IA
          </Button>
        </div>
        {editor.preview ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <RulesPreviewList preview={editor.preview} />
            <div className="flex gap-2">
              <Button size="sm" onClick={editor.confirmRules} disabled={editor.pending}>
                Guardar {editor.preview.rules.length} reglas
              </Button>
              <Button size="sm" variant="ghost" onClick={editor.discardPreview} disabled={editor.pending}>
                Descartar
              </Button>
            </div>
          </div>
        ) : rules.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {rules.map((rule) => (
              <li key={`${rule.model}-${rule.key}`} className="flex justify-between gap-2">
                <span>
                  {rule.model} · {ruleKeyLabel(rule.key)}
                </span>
                <span className="text-muted-foreground">{ruleValueLabel(rule.key, rule.value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin reglas guardadas</p>
        )}
      </section>
    </div>
  );
}
