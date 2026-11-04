import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import type { NormalizedImport } from "@/lib/sources/types";

type Database = PostgresJsDatabase<typeof schema>;

export interface FactsImportSummary {
  salesInserted: number;
  inventoryInserted: number;
  leadsInserted: number;
  factoryOrdersInserted: number;
}

const BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/**
 * Inserta los hechos normalizados (ventas, inventario, leads, pedidos
 * a fábrica) contra el catálogo ya sembrado. Ventas, leads y pedidos
 * son idempotentes por su índice único (line_hash / external_id):
 * reimportar el mismo Excel no duplica filas. El inventario es una
 * foto completa por mes, así que se reemplaza en cada corrida.
 */
export async function seedFacts(db: Database, parsed: NormalizedImport): Promise<FactsImportSummary> {
  const modelRows = await db.select().from(schema.models);
  const modelIdByName = new Map(modelRows.map((m) => [m.name, m.id]));
  const branchRows = await db.select().from(schema.branches);
  const branchIdByName = new Map(branchRows.map((b) => [b.name, b.id]));
  const lossReasonRows = await db.select().from(schema.lossReasons);
  const lossReasonIdByCategory = new Map<string, number>(
    lossReasonRows.map((r) => [r.category, r.id]),
  );

  let salesInserted = 0;
  for (const batch of chunk(parsed.sales, BATCH_SIZE)) {
    const values = batch.map((sale) => ({
      invoice: sale.invoice,
      lineHash: sale.lineHash,
      date: sale.date,
      branchId: sale.branchName ? branchIdByName.get(sale.branchName) ?? null : null,
      customerType: sale.customerType,
      customer: sale.customer,
      modelId: sale.modelName ? modelIdByName.get(sale.modelName) ?? null : null,
      version: sale.version,
      color: sale.color,
      units: sale.units,
      unitPrice: sale.unitPrice !== null ? String(sale.unitPrice) : null,
      isCreditNote: sale.isCreditNote,
      isFleetOutlier: sale.isFleetOutlier,
    }));
    const inserted = await db
      .insert(schema.sales)
      .values(values)
      .onConflictDoNothing({ target: schema.sales.lineHash })
      .returning({ id: schema.sales.id });
    salesInserted += inserted.length;
  }

  await db.delete(schema.inventorySnapshots);
  let inventoryInserted = 0;
  for (const batch of chunk(parsed.inventory, BATCH_SIZE)) {
    const values = batch.map((row) => ({
      monthEnd: row.monthEnd,
      modelId: row.modelName ? modelIdByName.get(row.modelName) ?? null : null,
      version: row.version,
      color: row.color,
      units: row.units,
      avgAgeDays: row.avgAgeDays,
    }));
    await db.insert(schema.inventorySnapshots).values(values);
    inventoryInserted += values.length;
  }

  let leadsInserted = 0;
  for (const batch of chunk(parsed.leads, BATCH_SIZE)) {
    const values = batch.map((lead) => ({
      externalId: lead.externalId,
      createdAt: lead.createdAt,
      closedAt: lead.closedAt,
      modelId: lead.modelName ? modelIdByName.get(lead.modelName) ?? null : null,
      units: lead.units,
      result: lead.result,
      reasonId: lead.lossReasonCategory ? lossReasonIdByCategory.get(lead.lossReasonCategory) ?? null : null,
      boughtModelId: lead.boughtModelName ? modelIdByName.get(lead.boughtModelName) ?? null : null,
    }));
    const inserted = await db
      .insert(schema.leads)
      .values(values)
      .onConflictDoNothing({ target: schema.leads.externalId })
      .returning({ id: schema.leads.id });
    leadsInserted += inserted.length;
  }

  let factoryOrdersInserted = 0;
  for (const batch of chunk(parsed.factoryOrders, BATCH_SIZE)) {
    const values = batch.map((order) => ({
      orderNo: order.orderNo,
      lineHash: order.lineHash,
      orderDate: order.orderDate,
      modelId: order.modelName ? modelIdByName.get(order.modelName) ?? null : null,
      units: order.units,
      eta: order.eta,
      status: order.status,
      receivedAt: order.receivedAt,
    }));
    const inserted = await db
      .insert(schema.factoryOrders)
      .values(values)
      .onConflictDoNothing({ target: schema.factoryOrders.lineHash })
      .returning({ id: schema.factoryOrders.id });
    factoryOrdersInserted += inserted.length;
  }

  return { salesInserted, inventoryInserted, leadsInserted, factoryOrdersInserted };
}
