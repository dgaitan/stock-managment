import "dotenv/config";
import { loadCycleConfig } from "@/lib/engine/config";
import { parseExcelFile } from "@/lib/sources/excel";
import { db } from "@/lib/db/client";
import { seedCatalog } from "@/lib/db/seedCatalog";

async function main() {
  const filePath = process.argv[2] ?? "data/seed/caso1.xlsx";
  const config = loadCycleConfig();
  const canonicalModels = config.models.map((m) => m.name);

  const parsed = parseExcelFile(filePath, canonicalModels, {
    fleetOutlierMinUnits: config.fleet_outlier_min_units,
  });

  const { modelIdByName } = await seedCatalog(db, config, parsed);

  console.log(`Catálogo cargado: ${modelIdByName.size} modelos.`);
  if (parsed.stats.modelosNoMapeados.length > 0) {
    console.log("Alerta: modelos sin mapear ->", parsed.stats.modelosNoMapeados);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
