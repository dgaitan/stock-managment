import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BulletinDraft } from "@/lib/bulletins/types";

type BulletinFormProps = {
  draft: BulletinDraft;
  onChange: (patch: Partial<BulletinDraft>) => void;
  identityLocked: boolean; // comunicados del Excel: fecha y asunto son su identidad
  disabled: boolean;
};

export function BulletinForm({ draft, onChange, identityLocked, disabled }: BulletinFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulletin-date">Fecha</Label>
          <Input
            id="bulletin-date"
            type="date"
            value={draft.date}
            disabled={disabled || identityLocked}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulletin-issuer">Emisor</Label>
          <Input
            id="bulletin-issuer"
            value={draft.issuer}
            disabled={disabled}
            onChange={(e) => onChange({ issuer: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bulletin-subject">Asunto</Label>
        <Input
          id="bulletin-subject"
          value={draft.subject}
          disabled={disabled || identityLocked}
          onChange={(e) => onChange({ subject: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bulletin-body">Texto del comunicado</Label>
        <Textarea
          id="bulletin-body"
          rows={8}
          value={draft.body}
          disabled={disabled}
          onChange={(e) => onChange({ body: e.target.value })}
        />
      </div>
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="mb-1 text-sm font-medium">Vigencia</legend>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={draft.scope === "permanent" ? "default" : "outline"}
            aria-pressed={draft.scope === "permanent"}
            onClick={() => onChange({ scope: "permanent" })}
          >
            Permanente
          </Button>
          <Button
            type="button"
            size="sm"
            variant={draft.scope === "cycle" ? "default" : "outline"}
            aria-pressed={draft.scope === "cycle"}
            onClick={() => onChange({ scope: "cycle" })}
          >
            Una ventana
          </Button>
        </div>
        {draft.scope === "cycle" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulletin-cycle">Ventana (AAAA-MM)</Label>
            <Input
              id="bulletin-cycle"
              placeholder="AAAA-MM"
              value={draft.cycle}
              onChange={(e) => onChange({ cycle: e.target.value })}
            />
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
