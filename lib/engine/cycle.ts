// Puro, sin Next/React/DB. Deriva el ciclo de pedido de los datos: el corte
// es el último cierre de inventario; la ventana, la siguiente de las
// trimestrales; la llegada, la ventana más el lead time. Nada de fechas ni
// meses fijos: cada ciclo se recalcula con el último corte importado.
// Ver docs/PLAN.md "Lógica del motor de pedido".

import { addMonths, monthKey, monthOfYear, monthRange, monthsBetween } from "@/lib/engine/months";

export interface Cycle {
  cutoffDate: string; // último cierre de inventario ("2026-09-30")
  window: string; // mes de la ventana de pedido que se está preparando ("2026-10")
  windowCloses: string; // último día hábil de la ventana ("2026-10-30")
  arrivalMonth: string; // mes en que llega este pedido: ventana + lead time ("2027-02")
  gapMonths: string[]; // meses entre el corte y la llegada: se venden sin este pedido
  coverageMonths: string[]; // desde la llegada hasta que llega el pedido de la ventana siguiente
}

/** Último día hábil (lunes a viernes) del mes: así cierran las ventanas según el comunicado de fábrica. */
export function lastBusinessDay(month: string): string {
  const day = new Date(Date.UTC(Number(month.slice(0, 4)), monthOfYear(month), 0));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/** Primer mes posterior a `after` cuyo número de mes (1-12) está en `windowMonths`. */
function nextWindowAfter(after: string, windowMonths: number[]): string {
  for (let step = 1; step <= 12; step++) {
    const candidate = addMonths(after, step);
    if (windowMonths.includes(monthOfYear(candidate))) return candidate;
  }
  throw new Error(`window_months no contiene meses válidos (1-12): ${windowMonths.join(", ")}`);
}

/**
 * Ciclo de pedido a partir del corte. El pedido llega `leadTimeMonths` después
 * de su ventana y debe cubrir hasta que llegue el de la ventana siguiente.
 */
export function deriveCycle(params: {
  cutoffDate: string;
  leadTimeMonths: number;
  windowMonths: number[];
}): Cycle {
  const { cutoffDate, leadTimeMonths, windowMonths } = params;
  if (!Number.isInteger(leadTimeMonths) || leadTimeMonths < 1) {
    throw new Error(`lead_time_months debe ser un entero >= 1 (recibido ${leadTimeMonths})`);
  }

  const cutoffMonth = monthKey(cutoffDate);
  const window = nextWindowAfter(cutoffMonth, windowMonths);
  const followingWindow = nextWindowAfter(window, windowMonths);
  const arrivalMonth = addMonths(window, leadTimeMonths);

  return {
    cutoffDate,
    window,
    windowCloses: lastBusinessDay(window),
    arrivalMonth,
    gapMonths: monthRange(addMonths(cutoffMonth, 1), monthsBetween(cutoffMonth, arrivalMonth) - 1),
    coverageMonths: monthRange(arrivalMonth, monthsBetween(window, followingWindow)),
  };
}

/** Último cierre de inventario cargado: el corte del ciclo. */
export function latestInventoryMonthEnd(inventory: { monthEnd: string }[]): string {
  if (inventory.length === 0) throw new Error("No hay inventario cargado: no se puede determinar el corte del ciclo");
  return inventory.reduce((latest, row) => (row.monthEnd > latest ? row.monthEnd : latest), inventory[0].monthEnd);
}
