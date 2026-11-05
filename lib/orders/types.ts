// Tipos de lo que guarda y lee la app de cada análisis (order_runs / order_lines).
// Sin imports de servidor: los usan Server y Client Components.

import type { StockAging } from "@/lib/engine/aging";
import type { ModelOrderPlan } from "@/lib/engine/order";
import type { OrderReason } from "@/lib/engine/reason";
import type { VersionMixRow } from "@/lib/engine/versionmix";

/** Lo que se guarda en order_lines.flags_json: el detalle que muestra «Ver por qué». */
export interface OrderLineDetail {
  plan: ModelOrderPlan;
  reason: OrderReason;
  aging: StockAging;
  versionMix: VersionMixRow[];
  lot: { min: number; multiple: number };
  versionMixWindowMonths: number;
}

export interface OrderLineView {
  modelId: number;
  modelName: string;
  orderUnits: number;
  capital: number;
  previousOrderUnits: number | null; // mismo modelo en el análisis anterior
  explanation: string;
  detail: OrderLineDetail;
}

export interface OrderRunView {
  id: number;
  version: number;
  createdAt: Date;
  cutoffDate: string;
  window: string;
  arrivalMonth: string;
  windowCloses: string;
  totalUnits: number;
  totalCapital: number;
  narrative: string | null;
  lines: OrderLineView[]; // ordenadas por pedido, mayor primero
}

/** Regla vigente para la ventana del cálculo, con el comunicado del que salió. */
export interface ActiveRule {
  id: number;
  model: string;
  key: string;
  value: string;
  cycle: string; // "permanent" o la ventana
  bulletin: { subject: string; date: string } | null; // null = regla sembrada inicial
  required: boolean; // el lote: no se puede omitir
}

/** Lo que necesita el diálogo «Calcular pedido» para armar sus pasos. */
export interface CalculationContext {
  window: string;
  cutoffDate: string;
  arrivalMonth: string;
  models: string[];
  months: string[]; // meses que cubre el cálculo (hasta la llegada y la cobertura); una consideración solo puede apuntar a ellos
  rules: ActiveRule[];
  aiEnabled: boolean;
}
