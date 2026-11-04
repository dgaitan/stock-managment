// Puro: arma, para cada modelo, el pedido del motor más el detalle que muestra la
// app (motivo, antigüedad, mezcla por versión, texto del «por qué»). La CLI y la
// app lo usan sobre lo que entrega loadEngineInputs.

import { agingThresholdDays, summarizeStockAging } from "@/lib/engine/aging";
import { explainOrder } from "@/lib/engine/explain";
import type { EngineInputs } from "@/lib/db/loadEngineInputs";
import { computeModelOrderPlan } from "@/lib/engine/order";
import { summarizeReason } from "@/lib/engine/reason";
import { suggestVersionMix } from "@/lib/engine/versionmix";
import type { OrderLineDetail } from "@/lib/orders/types";

export interface ComputedLine {
  modelName: string;
  orderUnits: number;
  capital: number;
  explanation: string;
  detail: OrderLineDetail;
}

const NO_ECONOMICS = { unitCost: 0, marginPct: 0, monthlyFinCost: 0 };

export function computeOrderLines(inputs: EngineInputs): ComputedLine[] {
  const { config, cycle, models, economicsByModel, data } = inputs;
  const thresholdDays = agingThresholdDays(config.aging_discounts);

  return models.map((model) => {
    const plan = computeModelOrderPlan({
      config,
      cycle,
      model,
      economics: economicsByModel.get(model.name) ?? NO_ECONOMICS,
      ...data,
    });
    const aging = summarizeStockAging({
      modelName: model.name,
      inventory: data.inventory,
      cutoffDate: cycle.cutoffDate,
      thresholdDays,
    });
    const versionMix = suggestVersionMix({
      modelName: model.name,
      orderUnits: plan.orderUnits,
      cutoffDate: cycle.cutoffDate,
      windowMonths: config.version_mix_window_months,
      sales: data.sales,
      leads: data.leads,
      factoryOrders: data.factoryOrders,
    });
    return {
      modelName: model.name,
      orderUnits: plan.orderUnits,
      capital: plan.capital,
      explanation: explainOrder(plan),
      detail: {
        plan,
        reason: summarizeReason(plan, aging),
        aging,
        versionMix,
        lot: { min: model.lot_min, multiple: model.lot_multiple },
        versionMixWindowMonths: config.version_mix_window_months,
      },
    };
  });
}
