// Comparación de una importación contra lo que ya está en la base. Puro: sin DB.

import type { PresentSheets } from "@/lib/sources/types";

/**
 * Cómo se aplica un archivo. `replace` (por defecto): cada hoja de hechos que trae
 * el archivo reemplaza esa hoja en la base, así que las filas que el archivo ya no
 * trae (una venta anulada en el ERP) se eliminan. `merge`: solo agrega y actualiza.
 * En ambos modos las hojas que el archivo no trae no se tocan, y nunca se borra lo
 * creado en la app (comunicados, reglas, análisis, alias).
 */
export type ImportMode = "replace" | "merge";

/** Hojas cuyas filas puede reemplazar un archivo. */
export type FactSheet = "sales" | "leads" | "factoryOrders" | "inventory";

export interface DiffCounts {
  inserted: number; // clave nueva
  updated: number; // misma clave, contenido distinto
  unchanged: number; // misma clave y mismo contenido
  deleted: number; // fila de la base que el archivo no trae y se elimina
}

export interface KeyedRow {
  key: string;
  hash: string;
}

/** Conteos de una hoja más las claves de la base que el archivo no trae. */
export interface SheetDiff {
  counts: DiffCounts;
  missingKeys: string[];
}

/** Qué cambiaría en la base si se confirma la importación. */
export interface ImportDiff {
  sales: DiffCounts;
  leads: DiffCounts;
  factoryOrders: DiffCounts;
  inventory: DiffCounts;
  economics: DiffCounts;
  bulletins: DiffCounts;
}

/** true si el archivo reemplaza la hoja: modo `replace` y la hoja viene en el archivo. */
export function replacesSheet(sheet: FactSheet, mode: ImportMode, present: PresentSheets): boolean {
  return mode === "replace" && present[sheet];
}

/**
 * Clasifica las filas entrantes contra las existentes (clave -> hash de contenido).
 * Las existentes que el archivo no trae cuentan como eliminadas; si la hoja no se
 * reemplaza, el llamador las conserva con `retainMissing`.
 */
export function classifyRows(existing: ReadonlyMap<string, string>, incoming: readonly KeyedRow[]): SheetDiff {
  const counts: DiffCounts = { inserted: 0, updated: 0, unchanged: 0, deleted: 0 };
  const seen = new Set<string>();
  for (const row of incoming) {
    seen.add(row.key);
    const current = existing.get(row.key);
    if (current === undefined) counts.inserted += 1;
    else if (current === row.hash) counts.unchanged += 1;
    else counts.updated += 1;
  }
  const missingKeys = [...existing.keys()].filter((key) => !seen.has(key));
  return { counts: { ...counts, deleted: missingKeys.length }, missingKeys };
}

/** La misma comparación sin eliminar nada: las filas que el archivo no trae se conservan. */
export function retainMissing(diff: SheetDiff): SheetDiff {
  return { counts: { ...diff.counts, deleted: 0 }, missingKeys: [] };
}

/**
 * Hash de la economía de un modelo, redondeado igual que las columnas numeric
 * de `models` (escala 2, 4 y 2): un valor ya guardado no aparece como
 * "actualizado" en cada importación.
 */
export function economicsHash(unitCost: unknown, marginPct: unknown, monthlyFinCost: unknown): string {
  return [
    Number(unitCost ?? 0).toFixed(2),
    Number(marginPct ?? 0).toFixed(4),
    Number(monthlyFinCost ?? 0).toFixed(2),
  ].join("|");
}

/** Economía por modelo: un modelo del catálogo que el archivo no trae no se borra ni cuenta como cambio. */
export function classifyEconomics(existing: ReadonlyMap<string, string>, incoming: readonly KeyedRow[]): DiffCounts {
  return retainMissing(classifyRows(existing, incoming)).counts;
}

/**
 * Comunicados: el Excel solo agrega los que no existen (fecha + asunto). Uno
 * que ya existe queda "sin cambios" aunque el archivo traiga otro texto: lo
 * gestiona el usuario en el CRUD.
 */
export function classifyBulletins(existingKeys: ReadonlySet<string>, incomingKeys: readonly string[]): DiffCounts {
  const inserted = incomingKeys.filter((key) => !existingKeys.has(key)).length;
  return { inserted, updated: 0, unchanged: incomingKeys.length - inserted, deleted: 0 };
}

/** true si la importación no cambiaría nada: ninguna hoja inserta, actualiza ni elimina filas. */
export function isNoop(diff: ImportDiff): boolean {
  return Object.values(diff).every((c) => c.inserted === 0 && c.updated === 0 && c.deleted === 0);
}

/**
 * Una fila por clave; si el archivo trae la misma clave dos veces, gana la
 * última (una corrección posterior). Evita que el upsert toque una fila dos
 * veces en el mismo lote.
 */
export function lastByKey<T>(rows: readonly T[], keyOf: (row: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(keyOf(row), row);
  return [...byKey.values()];
}

/**
 * Meses distintos que quedan en la base tras importar: los del archivo, más los
 * existentes si la hoja no se reemplaza. Alimenta la advertencia de historia corta.
 */
export function monthsAfterImport(fileMonths: readonly string[], existingMonths: readonly string[], replaced: boolean): number {
  return new Set([...fileMonths, ...(replaced ? [] : existingMonths)].filter(Boolean)).size;
}

/**
 * Hojas que el archivo trae vacías pero que, al reemplazarse, eliminarían filas: casi
 * siempre un export roto, no una intención. Se derivan del diff, sin mirar el modo.
 */
export function emptySheetsDeleting(diff: ImportDiff): { sheet: FactSheet; deleted: number }[] {
  const sheets: FactSheet[] = ["sales", "inventory", "leads", "factoryOrders"];
  return sheets.flatMap((sheet) => {
    const { inserted, updated, unchanged, deleted } = diff[sheet];
    return inserted + updated + unchanged === 0 && deleted > 0 ? [{ sheet, deleted }] : [];
  });
}
