// Comparación de una importación contra lo que ya está en la base. Puro: sin DB.

export interface DiffCounts {
  inserted: number; // clave nueva
  updated: number; // misma clave, contenido distinto
  unchanged: number; // misma clave y mismo contenido
  missing: number; // clave en la base que el archivo no trae
}

export interface KeyedRow {
  key: string;
  hash: string;
}

/**
 * Qué cambiaría en la base si se confirma la importación. En inventario,
 * `missing` son filas de los meses del archivo que se borrarán (el archivo
 * reemplaza esos meses); en ventas, leads y pedidos, `missing` se conserva.
 */
export interface ImportDiff {
  sales: DiffCounts;
  leads: DiffCounts;
  factoryOrders: DiffCounts;
  inventory: DiffCounts;
  economics: DiffCounts;
  bulletins: DiffCounts;
}

/** Clasifica las filas entrantes contra las existentes (clave -> hash de contenido). */
export function classifyRows(existing: ReadonlyMap<string, string>, incoming: readonly KeyedRow[]): DiffCounts {
  const counts: DiffCounts = { inserted: 0, updated: 0, unchanged: 0, missing: 0 };
  const seen = new Set<string>();
  for (const row of incoming) {
    seen.add(row.key);
    const current = existing.get(row.key);
    if (current === undefined) counts.inserted += 1;
    else if (current === row.hash) counts.unchanged += 1;
    else counts.updated += 1;
  }
  for (const key of existing.keys()) if (!seen.has(key)) counts.missing += 1;
  return counts;
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
  return { ...classifyRows(existing, incoming), missing: 0 };
}

/**
 * Comunicados: el Excel solo agrega los que no existen (fecha + asunto). Uno
 * que ya existe queda "sin cambios" aunque el archivo traiga otro texto: lo
 * gestiona el usuario en el CRUD.
 */
export function classifyBulletins(existingKeys: ReadonlySet<string>, incomingKeys: readonly string[]): DiffCounts {
  const inserted = incomingKeys.filter((key) => !existingKeys.has(key)).length;
  return { inserted, updated: 0, unchanged: incomingKeys.length - inserted, missing: 0 };
}

/**
 * true si la importación no cambiaría nada. En inventario, filas ausentes de un
 * mes del archivo sí son un cambio (se borran); en las demás hojas, no.
 */
export function isNoop(diff: ImportDiff): boolean {
  const { inventory, ...rest } = diff;
  const noInventoryChange = inventory.inserted === 0 && inventory.updated === 0 && inventory.missing === 0;
  return noInventoryChange && Object.values(rest).every((c) => c.inserted === 0 && c.updated === 0);
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
