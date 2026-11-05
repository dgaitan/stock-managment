"use client";

import { InfoIcon, MicIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useDictation } from "@/hooks/use-dictation";

type ConsiderationsStepProps = {
  text: string;
  onChange: (text: string) => void;
  saveAsBulletin: boolean;
  onSaveChange: (value: boolean) => void;
  disabled: boolean;
};

export function ConsiderationsStep({ text, onChange, saveAsBulletin, onSaveChange, disabled }: ConsiderationsStepProps) {
  const dictation = useDictation((phrase) => onChange(text.trim() ? `${text.trim()} ${phrase}` : phrase));

  return (
    <>
      <div>
        <label htmlFor="considerations" className="mb-1 block text-sm font-semibold">
          ¿Algo más que deba considerar este ciclo?
        </label>
        <p className="mb-2.5 text-[13px] text-muted-foreground">
          Promociones, topes, noticias de fábrica o un comunicado nuevo. Escríbelo o díctalo con tus palabras.
        </p>
        <div className="relative">
          <Textarea
            id="considerations"
            rows={6}
            value={text}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="pr-14"
          />
          {dictation.supported ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={dictation.listening ? "Detener dictado" : "Dictar con el micrófono"}
              aria-pressed={dictation.listening}
              disabled={disabled}
              onClick={dictation.toggle}
              className={`absolute right-2 bottom-3 ${dictation.listening ? "border-red-200 text-red-700" : ""}`}
            >
              <MicIcon className="size-[18px]" />
            </Button>
          ) : null}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
        <Checkbox checked={saveAsBulletin} onCheckedChange={(checked) => onSaveChange(checked === true)} />
        Guardar también como comunicado para próximos ciclos
      </label>
      <div className="flex items-start gap-2 rounded-lg border border-border bg-subtle px-3 py-2.5 text-xs text-zinc-600">
        <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>La IA solo traduce el texto a parámetros que verás en el paso 3 antes de calcular. Sin clave de IA este paso se omite.</span>
      </div>
    </>
  );
}
