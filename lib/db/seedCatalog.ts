import type { Executor } from "@/lib/db/factRows";
import type { CycleConfig } from "@/lib/engine/config";
import type { NormalizedImport } from "@/lib/sources/types";
import * as schema from "@/lib/db/schema";

const LOSS_REASON_CATEGORY_LABELS: Record<string, string> = {
  stock: "Falta de inventario",
  price: "Precio",
  financing: "Financiamiento",
  competitor: "Competencia",
  postponed: "Pospone",
  no_followup: "Sin seguimiento",
};

/**
 * Siembra el catálogo canónico: modelos (reglas de lote de cycle.yaml +
 * economía del Excel), sucursales, tipos de cliente, categorías de
 * motivo de pérdida y los alias (de modelo y de motivo) detectados en
 * la importación. Es seguro volver a correrlo: todo es upsert por la
 * clave natural de cada catálogo.
 */
export async function seedCatalog(
  db: Executor,
  config: CycleConfig,
  parsed: NormalizedImport,
): Promise<{ modelIdByName: Map<string, number> }> {
  const economicsByModel = new Map(
    parsed.economics.filter((e) => e.modelName).map((e) => [e.modelName as string, e]),
  );

  for (const model of config.models) {
    const economics = economicsByModel.get(model.name);
    await db
      .insert(schema.models)
      .values({
        name: model.name,
        unitCost: String(economics?.avgUnitCost ?? 0),
        marginPct: String(economics?.marginPct ?? 0),
        monthlyFinCost: String(economics?.monthlyFinCostPerUnit ?? 0),
        lotMin: model.lot_min,
        lotMultiple: model.lot_multiple,
        lifecycle: model.lifecycle ?? "active",
      })
      .onConflictDoUpdate({
        target: schema.models.name,
        set: {
          unitCost: String(economics?.avgUnitCost ?? 0),
          marginPct: String(economics?.marginPct ?? 0),
          monthlyFinCost: String(economics?.monthlyFinCostPerUnit ?? 0),
          lotMin: model.lot_min,
          lotMultiple: model.lot_multiple,
          lifecycle: model.lifecycle ?? "active",
        },
      });
  }

  const modelRows = await db.select().from(schema.models);
  const modelIdByName = new Map(modelRows.map((m) => [m.name, m.id]));

  // --- Sucursales y tipos de cliente (catálogos chicos, derivados de los datos) ---
  const branchNames = new Set<string>();
  const customerTypeNames = new Set<string>();
  for (const sale of parsed.sales) {
    if (sale.branchName) branchNames.add(sale.branchName);
    if (sale.customerType) customerTypeNames.add(sale.customerType);
  }
  for (const lead of parsed.leads) {
    if (lead.branchName) branchNames.add(lead.branchName);
    if (lead.customerType) customerTypeNames.add(lead.customerType);
  }

  for (const name of branchNames) {
    await db.insert(schema.branches).values({ name }).onConflictDoNothing();
  }
  for (const name of customerTypeNames) {
    await db.insert(schema.customerTypes).values({ name }).onConflictDoNothing();
  }

  // --- Categorías de motivo de pérdida (fijas, vienen de cycle.yaml) ---
  for (const category of config.loss_reason_categories) {
    await db
      .insert(schema.lossReasons)
      .values({ category: category as (typeof schema.lossReasons.$inferInsert)["category"] })
      .onConflictDoNothing();
  }
  const lossReasonRows = await db.select().from(schema.lossReasons);
  const lossReasonIdByCategory = new Map<string, number>(
    lossReasonRows.map((r) => [r.category, r.id]),
  );

  // --- Alias de motivo de pérdida detectados en Leads ---
  const lossReasonAliasSeen = new Map<string, string>();
  for (const lead of parsed.leads) {
    if (lead.lossReasonRaw && lead.lossReasonCategory) {
      lossReasonAliasSeen.set(lead.lossReasonRaw, lead.lossReasonCategory);
    }
  }
  for (const [rawText, category] of lossReasonAliasSeen) {
    const reasonId = lossReasonIdByCategory.get(category);
    if (!reasonId) continue;
    await db
      .insert(schema.lossReasonAliases)
      .values({ rawText, reasonId, source: "rule", confirmed: true })
      .onConflictDoNothing();
  }

  // --- Alias de modelo detectados en todas las hojas ---
  const modelAliasSeen = new Map<string, string>();
  const collectAlias = (raw: string, normalized: string | null) => {
    if (raw && normalized) modelAliasSeen.set(raw, normalized);
  };
  for (const sale of parsed.sales) collectAlias(sale.modelNameRaw, sale.modelName);
  for (const row of parsed.inventory) collectAlias(row.modelNameRaw, row.modelName);
  for (const lead of parsed.leads) {
    collectAlias(lead.modelNameRaw, lead.modelName);
    if (lead.boughtModelNameRaw) collectAlias(lead.boughtModelNameRaw, lead.boughtModelName);
  }
  for (const order of parsed.factoryOrders) collectAlias(order.modelNameRaw, order.modelName);

  for (const [alias, modelName] of modelAliasSeen) {
    const modelId = modelIdByName.get(modelName);
    if (!modelId) continue;
    await db
      .insert(schema.modelAliases)
      .values({ alias, modelId, source: "rule", confirmed: true })
      .onConflictDoNothing();
  }

  // Los comunicados no son catálogo: los agrega applyImport sin borrar los existentes.
  return { modelIdByName };
}

export function describeLossReasonCategory(category: string): string {
  return LOSS_REASON_CATEGORY_LABELS[category] ?? category;
}
