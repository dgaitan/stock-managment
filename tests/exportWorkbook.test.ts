import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { formatDecimal } from "@/lib/format";
import { buildOrderWorkbook, orderExportFileName, orderSheetRows, reasonText } from "@/lib/orders/exportWorkbook";
import type { OrderLineView, OrderRunView } from "@/lib/orders/types";

const line = (
  modelName: string,
  orderUnits: number,
  previousOrderUnits: number | null,
  extra: Partial<OrderLineView> & { badge?: OrderLineView["detail"]["reason"]["badge"] } = {},
): OrderLineView =>
  ({
    modelId: modelName.length,
    modelName,
    orderUnits,
    capital: orderUnits * 30_000.4,
    previousOrderUnits,
    demandFactor: extra.demandFactor ?? null,
    explanation: "",
    detail: { reason: { badge: extra.badge ?? null, text: "Stock a feb: 3 u." } },
  }) as OrderLineView;

const run = (lines: OrderLineView[]): OrderRunView => ({
  id: 1,
  version: 3,
  createdAt: new Date("2026-11-05T15:00:00Z"),
  cutoffDate: "2026-09-30",
  window: "2026-11",
  arrivalMonth: "2027-02",
  windowCloses: "2026-11-30",
  totalUnits: lines.reduce((a, l) => a + l.orderUnits, 0),
  totalCapital: lines.reduce((a, l) => a + l.capital, 0),
  narrative: null,
  rulesSummary: "reglas de los comunicados, sin consideraciones adicionales",
  lines,
});

describe("reasonText", () => {
  it("antepone la insignia de excepción o la regla del planificador", () => {
    expect(reasonText(line("Hilux", 10, null))).toBe("Stock a feb: 3 u.");
    expect(reasonText(line("Hilux", 10, null, { badge: "quiebre" }))).toBe("Falta de stock · Stock a feb: 3 u.");
    expect(reasonText(line("Hilux", 10, null, { badge: "quiebre", demandFactor: 1.2 }))).toBe(
      `Tu regla ×${formatDecimal(1.2)} · Stock a feb: 3 u.`,
    );
  });
});

describe("orderSheetRows", () => {
  it("una fila por modelo con el cambio contra el análisis anterior y el total", () => {
    const rows = orderSheetRows(run([line("Hilux", 72, 48), line("RAV4", 0, 4)]));
    const header = rows.findIndex((r) => r[0] === "Modelo");
    expect(rows[header + 1]).toEqual(["Hilux", 72, 48, 24, 2_160_029, "Stock a feb: 3 u."]);
    expect(rows[header + 2].slice(0, 5)).toEqual(["RAV4", 0, 4, -4, 0]);
    expect(rows.at(-1)?.slice(0, 4)).toEqual(["Total", 72, 52, 20]);
  });

  it("sin análisis anterior deja vacíos el pedido anterior y el cambio", () => {
    const rows = orderSheetRows(run([line("Hilux", 10, null)]));
    expect(rows.at(-2)?.slice(2, 4)).toEqual([null, null]);
    expect(rows.at(-1)?.slice(2, 4)).toEqual([null, null]);
  });
});

describe("buildOrderWorkbook", () => {
  it("genera un .xlsx legible con la hoja «Pedido sugerido»", () => {
    const book = XLSX.read(buildOrderWorkbook(run([line("Hilux", 72, 48)])), { type: "buffer" });
    expect(book.SheetNames).toEqual(["Pedido sugerido"]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets["Pedido sugerido"], { header: 1 });
    expect(rows.some((r) => r[0] === "Hilux" && r[1] === 72)).toBe(true);
  });

  it("muestra el capital como US$ con separador de miles, sin dejar de ser número", () => {
    const book = XLSX.read(buildOrderWorkbook(run([line("Hilux", 72, 48)])), { type: "buffer", cellNF: true });
    const sheet = book.Sheets["Pedido sugerido"];
    const capital = Object.keys(sheet)
      .filter((k) => k.startsWith("E"))
      .map((k) => sheet[k] as XLSX.CellObject)
      .find((c) => c.t === "n");
    expect(capital?.v).toBe(2_160_029);
    expect(capital?.z).toBe('"US$" #,##0');
    expect(XLSX.utils.format_cell(capital as XLSX.CellObject)).toBe("US$ 2,160,029");
  });

  it("nombra el archivo con versión y fecha", () => {
    expect(orderExportFileName(run([]))).toBe("pedido-sugerido-v3-2026-11-05.xlsx");
  });
});
