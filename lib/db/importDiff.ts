import { eq, inArray } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { bulletinKey, inventoryHash, inventoryKey, type Executor, type FactRows } from "@/lib/db/factRows";
import {
  classifyBulletins,
  classifyEconomics,
  classifyRows,
  economicsHash,
  type ImportDiff,
} from "@/lib/import/diff";
import type { NormalizedModelEconomics } from "@/lib/sources/types";

/** Lee lo que hay en la base y lo compara con la importación. Solo lee. */
export async function diffImport(
  db: Executor,
  rows: FactRows,
  economics: NormalizedModelEconomics[],
): Promise<ImportDiff> {
  const [sales, leads, orders, inventory, models, bulletins] = await Promise.all([
    db.select({ key: schema.sales.businessKey, hash: schema.sales.lineHash }).from(schema.sales),
    db.select({ key: schema.leads.externalId, hash: schema.leads.lineHash }).from(schema.leads),
    db.select({ key: schema.factoryOrders.businessKey, hash: schema.factoryOrders.lineHash }).from(schema.factoryOrders),
    rows.inventoryMonths.length === 0
      ? Promise.resolve([])
      : db
          .select({
            monthEnd: schema.inventorySnapshots.monthEnd,
            modelName: schema.models.name,
            version: schema.inventorySnapshots.version,
            color: schema.inventorySnapshots.color,
            units: schema.inventorySnapshots.units,
            avgAgeDays: schema.inventorySnapshots.avgAgeDays,
          })
          .from(schema.inventorySnapshots)
          .leftJoin(schema.models, eq(schema.models.id, schema.inventorySnapshots.modelId))
          .where(inArray(schema.inventorySnapshots.monthEnd, rows.inventoryMonths)),
    db.select().from(schema.models),
    db.select({ date: schema.bulletins.date, subject: schema.bulletins.subject }).from(schema.bulletins),
  ]);

  const toMap = (list: { key: string; hash: string }[]) => new Map(list.map((r) => [r.key, r.hash]));

  return {
    sales: classifyRows(toMap(sales), rows.sales.map((s) => ({ key: s.businessKey, hash: s.lineHash }))),
    leads: classifyRows(toMap(leads), rows.leads.map((l) => ({ key: l.externalId, hash: l.lineHash }))),
    factoryOrders: classifyRows(toMap(orders), rows.factoryOrders.map((o) => ({ key: o.businessKey, hash: o.lineHash }))),
    inventory: classifyRows(
      new Map(
        inventory.map((r) => [inventoryKey(r.monthEnd, r.modelName, r.version, r.color), inventoryHash(r.units, r.avgAgeDays)]),
      ),
      rows.inventory.map((i) => ({ key: i.key, hash: i.hash })),
    ),
    economics: classifyEconomics(
      new Map(models.map((m) => [m.name, economicsHash(m.unitCost, m.marginPct, m.monthlyFinCost)])),
      economics
        .filter((e) => e.modelName)
        .map((e) => ({ key: e.modelName as string, hash: economicsHash(e.avgUnitCost, e.marginPct, e.monthlyFinCostPerUnit) })),
    ),
    bulletins: classifyBulletins(
      new Set(bulletins.map((b) => bulletinKey(b.date, b.subject))),
      rows.bulletins.map((b) => bulletinKey(b.date, b.subject)),
    ),
  };
}
