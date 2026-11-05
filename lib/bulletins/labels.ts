// Textos en español de las reglas que el motor entiende y de la vigencia de un comunicado.
import { isRuleKey, type RuleKey } from "@/lib/engine/rules";
import { formatWindow } from "@/lib/format";

const RULE_KEY_LABELS: Record<RuleKey, string> = {
  lot_min: "Pedido mínimo",
  lot_multiple: "Múltiplo del lote",
  lifecycle: "Ciclo de vida",
  horizon_months: "Meses a cubrir",
  safety_stock_override: "Colchón fijo",
};

export function ruleKeyLabel(key: string): string {
  return isRuleKey(key) ? RULE_KEY_LABELS[key] : key;
}

export function ruleValueLabel(key: string, value: string): string {
  if (key === "lifecycle") return value === "last_window" ? "última ventana de la generación" : "vigente";
  if (key === "lot_min" || key === "lot_multiple" || key === "safety_stock_override") return `${value} u.`;
  return value;
}

/** «Permanente» o «Solo» seguido de la ventana (p. ej. «Solo oct-2026»). */
export function vigenciaLabel(scope: "permanent" | "cycle", cycle: string | null): string {
  return scope === "cycle" && cycle ? `Solo ${formatWindow(cycle)}` : "Permanente";
}
