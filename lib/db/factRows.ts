import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { lastByKey } from "@/lib/import/diff";
import type { NormalizedImport } from "@/lib/sources/types";

export type Database = PostgresJsDatabase<typeof schema>;
/** La base o una transacción abierta: las funciones de importación aceptan ambas. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

type SaleRow = typeof schema.sales.$inferInsert;
type LeadRow = typeof schema.leads.$inferInsert;
type FactoryOrderRow = typeof schema.factoryOrders.$inferInsert;
type InventoryRow = typeof schema.inventorySnapshots.$inferInsert;
type BulletinRow = typeof schema.bulletins.$inferInsert;

/** Inventario: foto por mes. La clave usa el nombre del modelo para no depender de ids. */
export interface InventoryFact {
  key: string;
  hash: string;
  row: InventoryRow;
}

export interface FactRows {
  sales: SaleRow[];
  leads: LeadRow[];
  factoryOrders: FactoryOrderRow[];
  inventory: InventoryFact[];
  inventoryMonths: string[];
  bulletins: BulletinRow[];
}

export function inventoryKey(monthEnd: string, modelName: string | null, version: string | null, color: string | null): string {
  return [monthEnd, modelName ?? "", version ?? "", color ?? ""].join("|");
}

export function inventoryHash(units: number, avgAgeDays: number | null): string {
  return `${units}|${avgAgeDays ?? ""}`;
}

export function bulletinKey(date: string, subject: string): string {
  return `${date}|${subject}`;
}

/** Traduce lo leído del Excel a filas de la base, resolviendo ids del catálogo. */
export async function buildFactRows(db: Executor, parsed: NormalizedImport): Promise<FactRows> {
  const [modelRows, branchRows, lossReasonRows] = await Promise.all([
    db.select().from(schema.models),
    db.select().from(schema.branches),
    db.select().from(schema.lossReasons),
  ]);
  const modelIdByName = new Map(modelRows.map((m) => [m.name, m.id]));
  const modelId = (name: string | null) => (name ? (modelIdByName.get(name) ?? null) : null);
  const branchIdByName = new Map(branchRows.map((b) => [b.name, b.id]));
  const reasonIdByCategory = new Map<string, number>(lossReasonRows.map((r) => [r.category, r.id]));

  const sales: SaleRow[] = lastByKey(parsed.sales, (s) => s.businessKey).map((sale) => ({
    invoice: sale.invoice,
    businessKey: sale.businessKey,
    lineHash: sale.lineHash,
    date: sale.date,
    branchId: sale.branchName ? (branchIdByName.get(sale.branchName) ?? null) : null,
    customerType: sale.customerType,
    customer: sale.customer,
    modelId: modelId(sale.modelName),
    version: sale.version,
    color: sale.color,
    units: sale.units,
    unitPrice: sale.unitPrice !== null ? String(sale.unitPrice) : null,
    isCreditNote: sale.isCreditNote,
    isFleetOutlier: sale.isFleetOutlier,
  }));

  const leads: LeadRow[] = lastByKey(parsed.leads, (l) => l.externalId).map((lead) => ({
    externalId: lead.externalId,
    lineHash: lead.lineHash,
    createdAt: lead.createdAt,
    closedAt: lead.closedAt,
    modelId: modelId(lead.modelName),
    units: lead.units,
    result: lead.result,
    reasonId: lead.lossReasonCategory ? (reasonIdByCategory.get(lead.lossReasonCategory) ?? null) : null,
    boughtModelId: modelId(lead.boughtModelName),
  }));

  const factoryOrders: FactoryOrderRow[] = lastByKey(parsed.factoryOrders, (o) => o.businessKey).map((order) => ({
    orderNo: order.orderNo,
    businessKey: order.businessKey,
    lineHash: order.lineHash,
    orderDate: order.orderDate,
    modelId: modelId(order.modelName),
    version: order.version,
    color: order.color,
    units: order.units,
    eta: order.eta,
    status: order.status,
    receivedAt: order.receivedAt,
  }));

  const inventory: InventoryFact[] = parsed.inventory
    .filter((row) => row.monthEnd !== "")
    .map((row) => ({
      key: inventoryKey(row.monthEnd, row.modelName, row.version, row.color),
      hash: inventoryHash(row.units, row.avgAgeDays),
      row: {
        monthEnd: row.monthEnd,
        modelId: modelId(row.modelName),
        version: row.version,
        color: row.color,
        units: row.units,
        avgAgeDays: row.avgAgeDays,
      },
    }));

  const bulletins: BulletinRow[] = parsed.bulletins
    .filter((b): b is typeof b & { date: string; subject: string } => b.date !== null && b.subject !== null)
    .map((b) => ({ date: b.date, issuer: b.issuer, subject: b.subject, body: b.body, source: "excel" as const }));

  return {
    sales,
    leads,
    factoryOrders,
    inventory,
    inventoryMonths: [...new Set(inventory.map((i) => i.row.monthEnd))].sort(),
    bulletins,
  };
}
