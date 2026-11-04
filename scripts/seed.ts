import "dotenv/config";
import { basename } from "node:path";
import { loadCycleConfig } from "@/lib/engine/config";
import { parseExcelFile } from "@/lib/sources/excel";
import { db } from "@/lib/db/client";
import { seedCatalog } from "@/lib/db/seedCatalog";
import { seedFacts } from "@/lib/db/seedFacts";
import * as schema from "@/lib/db/schema";

async function main() {
  const filePath = process.argv[2] ?? "data/seed/caso1.xlsx";
  const config = loadCycleConfig();
  const canonicalModels = config.models.map((m) => m.name);

  const parsed = parseExcelFile(filePath, canonicalModels, {
    fleetOutlierMinUnits: config.fleet_outlier_min_units,
  });

  const { modelIdByName } = await seedCatalog(db, config, parsed);
  const facts = await seedFacts(db, parsed);

  await db.insert(schema.imports).values({
    filename: basename(filePath),
    status: "ok",
    statsJson: { ...parsed.stats, ...facts },
  });

  console.log("--- Reporte de importación ---");
  console.log(`Modelos en catálogo: ${modelIdByName.size}`);
  console.log(`Modelos detectados en ventas: ${parsed.stats.modelosDetectados}`);
  console.log(`Filas de venta leídas: ${parsed.stats.ventasFilasLeidas}`);
  console.log(`Duplicados eliminados: ${parsed.stats.ventasDuplicadosEliminados}`);
  console.log(`Notas de crédito aplicadas: ${parsed.stats.ventasNotasCreditoAplicadas}`);
  console.log(`Ventas insertadas: ${facts.salesInserted}`);
  console.log(`Snapshots de inventario insertados: ${facts.inventoryInserted}`);
  console.log(`Leads insertados: ${facts.leadsInserted}`);
  console.log(`Pedidos a fábrica insertados: ${facts.factoryOrdersInserted}`);
  if (parsed.stats.modelosNoMapeados.length > 0) {
    console.log("Alerta: modelos sin mapear ->", parsed.stats.modelosNoMapeados);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
