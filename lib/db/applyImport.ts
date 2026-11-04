import { getTableColumns, inArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";
import type { Executor, FactRows } from "@/lib/db/factRows";

const BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** `SET col = excluded.col` para todas las columnas salvo el id y la clave. */
function excludedSet(table: PgTable, skip: string[]): Record<string, SQL> {
  const set: Record<string, SQL> = {};
  for (const [prop, column] of Object.entries(getTableColumns(table))) {
    if (prop === "id" || skip.includes(prop)) continue;
    set[prop] = sql.raw(`excluded."${column.name}"`);
  }
  return set;
}

/**
 * Escribe la importación. Se llama dentro de la transacción de commitImport:
 * - ventas, leads y pedidos: upsert por clave de negocio; solo se reescribe la
 *   fila si cambió su line_hash (p. ej. un lead que pasó a «Perdida» o un
 *   pedido que cambió de ETA o pasó a «Recibido»). Nada se borra.
 * - inventario: se reemplazan solo los meses que trae el archivo.
 * - comunicados: se agregan los que no existen (fecha + asunto); los que ya
 *   están no se tocan, porque el usuario puede haberlos editado o archivado.
 */
export async function applyImport(tx: Executor, rows: FactRows): Promise<void> {
  for (const batch of chunk(rows.sales, BATCH_SIZE)) {
    await tx
      .insert(schema.sales)
      .values(batch)
      .onConflictDoUpdate({
        target: schema.sales.businessKey,
        set: excludedSet(schema.sales, ["businessKey"]),
        setWhere: sql`${schema.sales.lineHash} <> excluded.line_hash`,
      });
  }

  for (const batch of chunk(rows.leads, BATCH_SIZE)) {
    await tx
      .insert(schema.leads)
      .values(batch)
      .onConflictDoUpdate({
        target: schema.leads.externalId,
        set: excludedSet(schema.leads, ["externalId"]),
        setWhere: sql`${schema.leads.lineHash} <> excluded.line_hash`,
      });
  }

  for (const batch of chunk(rows.factoryOrders, BATCH_SIZE)) {
    await tx
      .insert(schema.factoryOrders)
      .values(batch)
      .onConflictDoUpdate({
        target: schema.factoryOrders.businessKey,
        set: excludedSet(schema.factoryOrders, ["businessKey"]),
        setWhere: sql`${schema.factoryOrders.lineHash} <> excluded.line_hash`,
      });
  }

  if (rows.inventoryMonths.length > 0) {
    await tx.delete(schema.inventorySnapshots).where(inArray(schema.inventorySnapshots.monthEnd, rows.inventoryMonths));
    for (const batch of chunk(rows.inventory.map((i) => i.row), BATCH_SIZE)) {
      await tx.insert(schema.inventorySnapshots).values(batch);
    }
  }

  if (rows.bulletins.length > 0) {
    await tx
      .insert(schema.bulletins)
      .values(rows.bulletins)
      .onConflictDoNothing({ target: [schema.bulletins.date, schema.bulletins.subject] });
  }
}
