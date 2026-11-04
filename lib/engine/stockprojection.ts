// Puro, sin Next/React/DB. Proyecta el stock mes a mes hasta la llegada
// del pedido de la ventana vigente, con las llegadas reales (ETA) de los
// pedidos en tránsito. La demanda que no se puede atender por falta de
// stock se pierde (el cliente compra otro modelo o en otro lado), así
// que el stock nunca baja de 0 ni se arrastra como deuda al pedido.
// Ver docs/PLAN.md "Lógica del motor de pedido".

import { compareMonthKeys, monthKey } from "@/lib/engine/months";
import type { EngineFactoryOrder } from "@/lib/engine/inputs";

export interface StockProjection {
  stockEnd: number; // unidades en patio al terminar el último mes proyectado (>= 0)
  unmetDemand: number; // demanda perdida por falta de stock en el período
}

/** Una línea de pedido está en tránsito al corte si se hizo antes del corte y aún no se había recibido. */
export function isInTransitAtCutoff(
  order: EngineFactoryOrder,
  modelName: string,
  cutoffDate: string,
): boolean {
  if (order.modelName !== modelName || order.orderDate === null || order.orderDate > cutoffDate) return false;
  return order.receivedAt === null || order.receivedAt > cutoffDate;
}

/**
 * Llegadas de tránsito por mes de `months`. Un pedido sin ETA o con ETA
 * anterior al primer mes se asume que llega en el primer mes (ya debió
 * llegar); uno con ETA posterior al último mes llega al cierre del
 * período (cuenta en `stockEnd`, no puede venderse antes).
 */
export function groupTransitArrivals(params: {
  modelName: string;
  factoryOrders: EngineFactoryOrder[];
  cutoffDate: string;
  months: string[];
}): { byMonth: Record<string, number>; afterPeriod: number } {
  const { modelName, factoryOrders, cutoffDate, months } = params;
  const first = months[0];
  const last = months[months.length - 1];
  const byMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  let afterPeriod = 0;

  for (const order of factoryOrders) {
    if (!isInTransitAtCutoff(order, modelName, cutoffDate)) continue;

    const etaMonth = order.eta === null ? first : monthKey(order.eta);
    if (compareMonthKeys(etaMonth, last) > 0) afterPeriod += order.units;
    else byMonth[compareMonthKeys(etaMonth, first) < 0 ? first : etaMonth] += order.units;
  }
  return { byMonth, afterPeriod };
}

/**
 * Simula el stock mes a mes: entra el tránsito del mes, se vende lo que
 * haya hasta la demanda pronosticada y el resto de la demanda se pierde.
 */
export function projectStock(params: {
  startingStock: number;
  months: string[];
  arrivalsByMonth: Record<string, number>;
  arrivalsAfterPeriod: number;
  forecastByMonth: Record<string, number>;
}): StockProjection {
  const { startingStock, months, arrivalsByMonth, arrivalsAfterPeriod, forecastByMonth } = params;
  let stock = startingStock;
  let unmetDemand = 0;

  for (const month of months) {
    stock += arrivalsByMonth[month] ?? 0;
    const demand = forecastByMonth[month] ?? 0;
    const sold = Math.min(stock, demand);
    unmetDemand += demand - sold;
    stock -= sold;
  }

  return { stockEnd: stock + arrivalsAfterPeriod, unmetDemand };
}
