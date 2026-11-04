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
      <Label htmlFor="considerations">Reglas adicionales (opcional)</Label>
      <Textarea
        id="considerations"
        rows={7}
        value={text}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Promociones, topes, noticias de fábrica… por ejemplo: «Hay promoción de un modelo en dos meses y esperamos 30 % más de demanda» o «No pedir un modelo este ciclo»."
      />
      <p className="text-xs text-muted-foreground">
        La IA lo traduce a parámetros acotados (demanda × factor y excluir un modelo). Lo que el motor no entiende se
        marca como «no aplicada»; la IA nunca escribe cantidades. Déjalo vacío para omitir este paso.
      </p>
    </div>
  );
}
