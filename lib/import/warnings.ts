// Puro, sin red ni base. Advertencias de una importación: datos que se guardan
// pero no entran al cálculo como el usuario esperaría. Nada se ignora en silencio:
// si hay advertencias, confirmar exige aceptarlas (drawer y CLI usan esta lista).

import { emptySheetsDeleting, type ImportDiff } from "@/lib/import/diff";
import { SHEET_LABELS } from "@/lib/import/labels";
import type { ImportStats } from "@/lib/sources/types";

type WarningStats = Pick<
  ImportStats,
  "modelosNoMapeados" | "filasModeloSinMapear" | "motivosNoMapeados" | "leadsMotivoSinMapear"
>;

/** Meses distintos de ventas e inventario que quedarían en la base al confirmar. */
export interface HistoryAfterImport {
  salesMonths: number;
  inventoryMonths: number;
}

const quoted = (names: string[]) => names.map((n) => `«${n}»`).join(", ");
const rows = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export interface WarningContext {
  diff: ImportDiff;
  history: HistoryAfterImport;
  minHistoryMonths: number;
}

export function importWarnings(stats: WarningStats, { diff, history, minHistoryMonths }: WarningContext): string[] {
  const warnings: string[] = [];
  if (stats.modelosNoMapeados.length > 0) {
    warnings.push(
      `Modelos sin mapear (${quoted(stats.modelosNoMapeados)}): ${rows(stats.filasModeloSinMapear, "fila queda", "filas quedan")} fuera del cálculo.`,
    );
  }
  if (stats.motivosNoMapeados.length > 0) {
    warnings.push(
      `Motivos de pérdida sin mapear (${quoted(stats.motivosNoMapeados)}): ${rows(stats.leadsMotivoSinMapear, "lead no cuenta", "leads no cuentan")} como pérdida por falta de stock.`,
    );
  }
  for (const { sheet, deleted } of emptySheetsDeleting(diff)) {
    warnings.push(`La hoja «${SHEET_LABELS[sheet]}» viene vacía: reemplazarla eliminaría ${rows(deleted, "fila", "filas")}.`);
  }
  if (history.salesMonths < minHistoryMonths || history.inventoryMonths < minHistoryMonths) {
    warnings.push(
      `Quedarían ${rows(history.salesMonths, "mes", "meses")} de ventas y ${rows(history.inventoryMonths, "mes", "meses")} de inventario; el pronóstico necesita al menos ${minHistoryMonths}: el pedido no sería confiable.`,
    );
  }
  return warnings;
}
