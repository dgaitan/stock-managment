import { InfoTip } from "@/components/molecules/info-tip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ConsiderationsStepProps = {
  text: string;
  onChange: (text: string) => void;
  disabled: boolean;
};

export function ConsiderationsStep({ text, onChange, disabled }: ConsiderationsStepProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="considerations">
        Reglas adicionales (opcional)
        <InfoTip label="Cómo se interpretan">
          La IA lo traduce a parámetros acotados: demanda × factor por modelo y meses, o excluir un modelo. Lo que el
          motor no entiende queda como «no se aplica». La IA nunca escribe cantidades.
        </InfoTip>
      </Label>
      <Textarea
        id="considerations"
        rows={6}
        value={text}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej.: «Promoción de Hilux en feb–abr, esperamos 20 % más de demanda»"
      />
    </div>
  );
}
