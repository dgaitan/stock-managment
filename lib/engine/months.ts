// Puro, sin Next/React/DB. Aritmética de claves de mes ("YYYY-MM") que
// comparten stockflow, demand, forecast y order para no reimplementar
// parseo de fechas en cada módulo.

/** "2026-09-30" -> "2026-09" */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** "2026-09" -> 9 */
export function monthOfYear(key: string): number {
  return Number(key.slice(5, 7));
}

/** "2026-09" -> 2026 */
export function yearOf(key: string): number {
  return Number(key.slice(0, 4));
}

/** Desplaza una clave de mes N meses (N negativo retrocede). */
export function addMonths(key: string, n: number): string {
  const year = yearOf(key);
  const month = monthOfYear(key) - 1; // 0-indexado
  const total = year * 12 + month + n;
  const newYear = Math.floor(total / 12);
  const newMonth = ((total % 12) + 12) % 12;
  return `${newYear}-${String(newMonth + 1).padStart(2, "0")}`;
}

/** Lista de N claves de mes consecutivas empezando en `start` (inclusive). */
export function monthRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(start, i));
}

/** Compara dos claves de mes ("2026-09" < "2026-10"). */
export function compareMonthKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
