import * as XLSX from "xlsx";
import { collapseSpaces, excelSerialToISODate } from "@/lib/engine/clean";

// Lectura de celdas del Excel a tipos simples. Compartido por los parsers de hoja.

export type Row = Record<string, unknown>;

export function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Row[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
}

export function toISODate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return excelSerialToISODate(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return null;
}

export function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = collapseSpaces(String(value));
  return text === "" ? null : text;
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
