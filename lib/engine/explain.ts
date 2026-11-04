// Puro, sin Next/React/DB. Genera el texto del "por qué" de un pedido
// a partir del resultado de order.ts. La IA nunca decide la cifra; esto
// solo narra en español los números ya calculados deterministicamente.
// Ver docs/PLAN.md "Lógica del motor de pedido", paso 8.

import type { ModelOrderPlan } from "@/lib/engine/order";

const SPANISH_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function monthLabel(key: string): string {
  const month = Number(key.slice(5, 7));
  return SPANISH_MONTHS[month - 1];
}

/** "2027-02" .. "2027-04" -> "feb-abr 2027" (o "feb 2027" si es un solo mes). */
export function formatMonthRangeLabel(months: string[]): string {
  if (months.length === 0) return "";
  const first = months[0];
  const last = months[months.length - 1];
  const year = first.slice(0, 4);
  if (first === last) return `${monthLabel(first)} ${year}`;
  return `${monthLabel(first)}-${monthLabel(last)} ${year}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatMoney(value: number): string {
  return Math.round(value).toLocaleString("es-NI");
}

const FLAG_LABELS: Record<string, string> = {
  sin_historia_suficiente_para_estacionalidad: "sin suficiente historia para estacionalidad, pronóstico plano",
  ultima_ventana_de_generacion: "última ventana de esta generación, sin colchón de seguridad",
  necesidad_bajo_minimo_efectivo_pedido_cero: "necesidad bajo el mínimo efectivo, pedido ajustado a 0",
  sin_necesidad_pedido_cero: "sin necesidad neta, pedido en 0",
};

/** Texto en español del "por qué" del pedido sugerido para un modelo. */
export function explainOrder(plan: ModelOrderPlan): string {
  const parts: string[] = [];

  parts.push(
    `Se proyecta una demanda de ~${round1(plan.forecastMonthlyRate)} u/mes para ${plan.modelName}` +
      `${plan.hasSeasonalIndex ? " (ajustada por estacionalidad)" : " (sin ajuste estacional, poca historia)"}.`,
  );

  parts.push(
    `Con ${plan.patioAtCutoff} u. en patio y ${plan.transitoAtCutoff} u. en tránsito al corte, y una demanda ` +
      `estimada de ${round1(plan.demandOctEne)} u. hasta que llegue el pedido de enero, el stock proyectado a ` +
      `febrero es de ${round1(plan.projectedStockFeb)} u.`,
  );

  if (plan.unmetDemandOctEne > 0) {
    parts.push(
      `Sin stock suficiente, ~${round1(plan.unmetDemandOctEne)} u. de esa demanda no se podrán atender antes de febrero; ` +
        "se consideran ventas perdidas y no se suman al pedido.",
    );
  }

  parts.push(
    `La ventana de cobertura (${formatMonthRangeLabel(plan.coverageMonths)}) necesita ${round1(plan.demandCoverageWindow)} u., ` +
      `más un colchón de seguridad de ${round1(plan.safetyStockUnits)} u. (nivel ${plan.safetyTier}), para una ` +
      `necesidad neta de ${round1(plan.need)} u.`,
  );

  if (plan.orderUnits === 0) {
    parts.push("La necesidad no justifica pedido este ciclo, así que el pedido sugerido es 0 unidades.");
  } else {
    parts.push(
      `Redondeado al mínimo y múltiplo de lote del modelo, el pedido sugerido es de ${plan.orderUnits} unidades ` +
        `(~$${formatMoney(plan.capital)} de capital, ~$${formatMoney(plan.monthlyFinCostEstimate)}/mes de costo financiero).`,
    );
  }

  if (plan.flags.length > 0) {
    const labels = plan.flags.map((f) => FLAG_LABELS[f] ?? f);
    parts.push(`Alertas: ${labels.join("; ")}.`);
  }

  return parts.join(" ");
}
