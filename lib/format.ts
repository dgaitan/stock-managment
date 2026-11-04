// Formato de cifras y fechas para la UI (es-NI). Sin lógica de negocio.

import { monthLabel } from "@/lib/engine/explain";

const number = new Intl.NumberFormat("es-NI", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-NI", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const formatInt = (value: number): string => number.format(value);
export const formatDecimal = (value: number): string => decimal.format(value);
export const formatUsd = (value: number): string => number.format(Math.round(value));

export function formatUsdMillions(value: number): string {
  return `US$ ${(value / 1_000_000).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
}

/** "2026-09-30" -> "30 sep 2026" */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day} ${monthLabel(`${year}-${month}`)} ${year}`;
}

export function formatTimestamp(value: Date): string {
  return formatIsoDate(value.toISOString().slice(0, 10));
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria de la operación, no en UTC. */
export function todayIsoDate(timeZone = "America/Managua"): string {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}
