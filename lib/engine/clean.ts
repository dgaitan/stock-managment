import { createHash } from "node:crypto";

// Puro, sin Next/React/DB. Reglas de limpieza compartidas por los
// adaptadores de entrada (Excel, manual, a futuro ERP).

/** Colapsa espacios repetidos y recorta extremos. */
export function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Normaliza un nombre de modelo crudo contra el catálogo canónico.
 * Reglas, en orden: recortar espacios, colapsar espacios internos,
 * quitar el prefijo "Toyota ", comparar sin distinguir mayúsculas.
 * Devuelve null si no coincide con ningún modelo canónico (requiere
 * revisión manual o mapeo de IA, nunca se inventa una coincidencia).
 */
export function normalizeModelName(
  raw: string | null | undefined,
  canonicalModels: readonly string[],
): string | null {
  if (!raw) return null;
  let value = collapseSpaces(raw);
  value = value.replace(/^toyota\s+/i, "");
  if (!value) return null;

  const target = value.toLowerCase();
  for (const canonical of canonicalModels) {
    if (canonical.toLowerCase() === target) return canonical;
  }
  return null;
}

/** Sucursales canónicas (7, ver docs/PLAN.md). */
export const CANONICAL_BRANCHES = [
  "Managua Central",
  "Managua Sur",
  "León",
  "Chinandega",
  "Estelí",
  "Matagalpa",
  "Juigalpa",
] as const;

/** Abreviaturas conocidas que no se resuelven solo quitando acentos/mayúsculas. */
const BRANCH_ABBREVIATIONS: Record<string, string> = {
  "mga sur": "Managua Sur",
};

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Normaliza un nombre de sucursal crudo: quita acentos y mayúsculas
 * para emparejar contra el catálogo canónico ("Esteli" / "ESTELÍ" ->
 * "Estelí"), y resuelve abreviaturas conocidas ("Mga Sur" -> "Managua
 * Sur"). Devuelve null si no coincide con ninguna sucursal canónica.
 */
export function normalizeBranchName(
  raw: string | null | undefined,
  canonicalBranches: readonly string[] = CANONICAL_BRANCHES,
): string | null {
  if (!raw) return null;
  const value = collapseSpaces(raw);
  if (!value) return null;

  const folded = stripAccents(value).toLowerCase();
  for (const canonical of canonicalBranches) {
    if (stripAccents(canonical).toLowerCase() === folded) return canonical;
  }
  return BRANCH_ABBREVIATIONS[folded] ?? null;
}

export type LossReasonCategory =
  | "stock"
  | "price"
  | "financing"
  | "competitor"
  | "postponed"
  | "no_followup";

/**
 * Diccionario de motivos de pérdida crudos (tal como aparecen en el CRM)
 * a las 6 categorías estándar. El motivo "sin stock" tiene 8 variantes
 * en los datos del caso; todas caen en la categoría `stock`.
 */
const LOSS_REASON_MAP: Record<string, LossReasonCategory> = {
  "sin disponibilidad": "stock",
  "sin inventario": "stock",
  "sin stock": "stock",
  "sin disponibilidad / sin inventario": "stock",
  "sin disponibilidad de versión/color": "stock",
  "no hay unidades disponibles": "stock",
  "color no disponible": "stock",
  "versión no disponible": "stock",
  precio: "price",
  "financiamiento rechazado": "financing",
  "compró a la competencia": "competitor",
  "pospone la compra": "postponed",
  "no responde / sin seguimiento": "no_followup",
};

/**
 * Mapea un motivo de pérdida crudo a su categoría estándar. Devuelve
 * null si el texto no está en el diccionario (queda para revisión
 * manual, nunca se asume una categoría).
 */
export function normalizeLossReason(
  raw: string | null | undefined,
): LossReasonCategory | null {
  if (!raw) return null;
  const key = collapseSpaces(raw).toLowerCase();
  return LOSS_REASON_MAP[key] ?? null;
}

/** true si la factura corresponde a una nota de crédito (prefijo "NC"). */
export function isCreditNote(invoice: string | null | undefined): boolean {
  if (!invoice) return false;
  return /^nc-/i.test(invoice.trim());
}

/**
 * true si la línea es una venta de flota/institucional fuera de la
 * ventana normal de demanda (se excluye de la demanda base del motor).
 */
export function isFleetOutlier(
  customerType: string | null | undefined,
  units: number,
  fleetOutlierMinUnits: number,
): boolean {
  return customerType === "Flota / Institucional" && units >= fleetOutlierMinUnits;
}

/**
 * Hash estable de una línea de hecho (venta, pedido, etc.) para
 * idempotencia de importación: reimportar el mismo Excel no duplica
 * filas porque el hash de una línea ya importada coincide.
 */
export function computeLineHash(parts: Array<string | number | boolean | null | undefined>): string {
  const normalized = parts.map((p) => (p === null || p === undefined ? "" : String(p)));
  return createHash("sha256").update(normalized.join("|")).digest("hex");
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Convierte un serial de fecha de Excel a ISO (YYYY-MM-DD). */
export function excelSerialToISODate(serial: number): string {
  const ms = EXCEL_EPOCH_MS + Math.round(serial) * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}
