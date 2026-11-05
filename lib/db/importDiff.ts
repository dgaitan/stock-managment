import { eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { bulletinKey, inventoryHash, inventoryKey, type Executor, type FactRows } from "@/lib/db/factRows";
import {
  classifyBulletins,
  classifyEconomics,
  classifyRows,
  economicsHash,
  monthsAfterImport,
  replacesSheet,
  retainMissing,
  type FactSheet,
  type ImportDiff,
  type ImportMode,
  type SheetDiff,
} from "@/lib/import/diff";
import type { HistoryAfterImport } from "@/lib/import/warnings";
import type { NormalizedModelEconomics, PresentSheets } from "@/lib/sources/types";

/** Lo que `applyImport` borra además del upsert. */
export interface DeletionPlan {
  sales: string[]; // business_key
  leads: string[]; // external_id
  factoryOrders: string[]; // business_key
  inventoryMonths: string[] | "all"; // meses de inventario que se reemplazan
}

export interface ImportPlan {
  diff: ImportDiff;
  deletions: DeletionPlan;
  history: HistoryAfterImport;
}

const toMap = (list: { key: string; hash: string }[]) => new Map(list.map((r) => [r.key, r.hash]));
const monthOf = (isoDate: string) => isoDate.slice(0, 7);

/** Lee lo que hay en la base y lo compara con la importación. Solo lee. */
export async function diffImport(
  db: Executor,
  rows: FactRows,
  economics: NormalizedModelEconomics[],
  present: PresentSheets,
  mode: ImportMode,
): Promise<ImportPlan> {
  const replaces = (sheet: FactSheet) => replacesSheet(sheet, mode, present);
  const inventoryMonths = replaces("inventory") ? "all" : rows.inventoryMonths;

  const [sales, leads, orders, inventory, models, bulletins, salesMonths, stockMonths] = await Promise.all([
    db.select({ key: schema.sales.businessKey, hash: schema.sales.lineHash }).from(schema.sales),
    db.select({ key: schema.leads.externalId, hash: schema.leads.lineHash }).from(schema.leads),
    db.select({ key: schema.factoryOrders.businessKey, hash: schema.factoryOrders.lineHash }).from(schema.factoryOrders),
    inventoryMonths !== "all" && inventoryMonths.length === 0
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
          .where(inventoryMonths === "all" ? undefined : inArray(schema.inventorySnapshots.monthEnd, inventoryMonths)),
    db.select().from(schema.models),
    db.select({ date: schema.bulletins.date, subject: schema.bulletins.subject }).from(schema.bulletins),
    db.selectDistinct({ month: sql<string>`to_char(${schema.sales.date}, 'YYYY-MM')` }).from(schema.sales),
    db.selectDistinct({ month: sql<string>`to_char(${schema.inventorySnapshots.monthEnd}, 'YYYY-MM')` }).from(schema.inventorySnapshots),
  ]);

  const factSheet = (sheet: FactSheet, existing: { key: string; hash: string }[], incoming: { key: string; hash: string }[]): SheetDiff => {
    const diff = classifyRows(toMap(existing), incoming);
    return replaces(sheet) ? diff : retainMissing(diff);
  };
  const salesDiff = factSheet("sales", sales, rows.sales.map((s) => ({ key: s.businessKey, hash: s.lineHash })));
  const leadsDiff = factSheet("leads", leads, rows.leads.map((l) => ({ key: l.externalId, hash: l.lineHash })));
  const ordersDiff = factSheet("factoryOrders", orders, rows.factoryOrders.map((o) => ({ key: o.businessKey, hash: o.lineHash })));
  // El inventario siempre reemplaza su alcance: los meses del archivo, o todo si la hoja se reemplaza.
  const inventoryDiff = classifyRows(
    new Map(inventory.map((r) => [inventoryKey(r.monthEnd, r.modelName, r.version, r.color), inventoryHash(r.units, r.avgAgeDays)])),
    rows.inventory.map((i) => ({ key: i.key, hash: i.hash })),
  );

  return {
    diff: {
      sales: salesDiff.counts,
      leads: leadsDiff.counts,
      factoryOrders: ordersDiff.counts,
      inventory: inventoryDiff.counts,
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
    },
    deletions: {
      sales: salesDiff.missingKeys,
      leads: leadsDiff.missingKeys,
      factoryOrders: ordersDiff.missingKeys,
      inventoryMonths,
    },
    history: {
      salesMonths: monthsAfterImport(rows.sales.map((s) => monthOf(s.date)), salesMonths.map((r) => r.month), replaces("sales")),
      inventoryMonths: monthsAfterImport(rows.inventoryMonths.map(monthOf), stockMonths.map((r) => r.month), replaces("inventory")),
    },
  };
}
