// Exporta el «Pedido sugerido» a Excel: las mismas columnas que la tabla del
// dashboard (modelo, pedido, capital, motivo) más el cambio contra el análisis
// anterior. Puro, sin servidor: recibe el análisis ya leído.

import * as XLSX from "xlsx";
import { monthLabelWithYear } from "@/lib/engine/explain";
import { REASON_BADGE_LABELS } from "@/lib/engine/reason";
import { formatShortDate, formatTimestamp, formatWindow } from "@/lib/format";
import { demandFactorLabel } from "@/lib/orders/runSummary";
import type { OrderLineView, OrderRunView } from "@/lib/orders/types";

const CAPITAL_COLUMN = 4; // «Capital (USD)»
const USD_FORMAT = '"US$" #,##0'; // US$ 3,144,960: sigue siendo número (suma y ordena en Excel)

const HEADER = ["Modelo", "Pedido (u.)", "Pedido anterior (u.)", "Cambio (u.)", "Capital (USD)", "Motivo"];

/** Motivo en una celda: la insignia de la tabla (si hay) y el texto. */
export function reasonText(line: Pick<OrderLineView, "demandFactor" | "detail">): string {
  const { reason } = line.detail;
  const badge =
    line.demandFactor !== null ? demandFactorLabel(line.demandFactor) : reason.badge ? REASON_BADGE_LABELS[reason.badge] : null;
  return badge ? `${badge} · ${reason.text}` : reason.text;
}

/** Filas de la hoja: encabezado del análisis, tabla por modelo y total. */
export function orderSheetRows(run: OrderRunView): (string | number | null)[][] {
  const hasPrevious = run.lines.some((l) => l.previousOrderUnits !== null);
  const previousTotal = hasPrevious ? run.lines.reduce((acc, l) => acc + (l.previousOrderUnits ?? 0), 0) : null;
  const delta = (current: number, previous: number | null) => (previous === null ? null : current - previous);

  return [
    ["Pedido sugerido"],
    [`Análisis v${run.version} · ${formatTimestamp(run.createdAt)} · ${run.rulesSummary}`],
    [
      `Ventana ${formatWindow(run.window)} · llegada ${monthLabelWithYear(run.arrivalMonth)} · datos al ${formatShortDate(run.cutoffDate)}`,
    ],
    [],
    HEADER,
    ...run.lines.map((l) => [
      l.modelName,
      l.orderUnits,
      l.previousOrderUnits,
      delta(l.orderUnits, l.previousOrderUnits),
      Math.round(l.capital),
      reasonText(l),
    ]),
    ["Total", run.totalUnits, previousTotal, delta(run.totalUnits, previousTotal), Math.round(run.totalCapital), null],
  ];
}

/** Libro .xlsx listo para descargar. */
export function buildOrderWorkbook(run: OrderRunView): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(orderSheetRows(run));
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  for (let row = range.s.r; row <= range.e.r; row++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: CAPITAL_COLUMN })] as XLSX.CellObject | undefined;
    if (cell?.t === "n") cell.z = USD_FORMAT;
  }
  sheet["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 80 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Pedido sugerido");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** «pedido-sugerido-v3-2026-11-05.xlsx» */
export function orderExportFileName(run: Pick<OrderRunView, "version" | "createdAt">): string {
  return `pedido-sugerido-v${run.version}-${run.createdAt.toISOString().slice(0, 10)}.xlsx`;
}
