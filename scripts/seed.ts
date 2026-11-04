import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadCycleConfig, loadCycleRules } from "@/lib/engine/config";
import { modelNamesFromRules } from "@/lib/engine/rules";
import { parseExcelFile } from "@/lib/sources/excel";
import { db } from "@/lib/db/client";
import { seedCycleRules } from "@/lib/db/seedCatalog";
import { commitImport, previewImport } from "@/lib/db/importWorkbook";
import type { ImportDiff } from "@/lib/import/diff";

const SHEET_LABELS: Record<keyof ImportDiff, string> = {
  sales: "Ventas",
  inventory: "Inventario",
  leads: "Leads",
  factoryOrders: "Pedidos a fábrica",
  economics: "Economía por modelo",
  bulletins: "Comunicados",
};

async function main() {
  const filePath = process.argv[2] ?? "data/seed/caso1.xlsx";
  const config = loadCycleConfig();
  const rules = loadCycleRules();

  const parsed = parseExcelFile(filePath, modelNamesFromRules(rules), {
    fleetOutlierMinUnits: config.fleet_outlier_min_units,
  });
  const preview = await previewImport(db, parsed, readFileSync(filePath));

  console.log("--- Reporte de importación ---");
  console.log(`Corte detectado: ${preview.cutoffDate ?? "sin inventario"}`);
  console.log(`Modelos detectados en ventas: ${parsed.stats.modelosDetectados}`);
  console.log(`Filas de venta leídas: ${parsed.stats.ventasFilasLeidas}`);
  console.log(`Duplicados eliminados: ${parsed.stats.ventasDuplicadosEliminados}`);
  console.log(`Notas de crédito aplicadas: ${parsed.stats.ventasNotasCreditoAplicadas}`);
  console.log(`Leads duplicados eliminados: ${parsed.stats.leadsDuplicadosEliminados}`);
  if (parsed.stats.modelosNoMapeados.length > 0) {
    console.log("Alerta: modelos sin mapear ->", parsed.stats.modelosNoMapeados);
  }

  console.log("\n--- Qué cambia en la base ---");
  console.table(
    (Object.keys(SHEET_LABELS) as (keyof ImportDiff)[]).map((sheet) => {
      const d = preview.diff[sheet];
      return {
        Hoja: SHEET_LABELS[sheet],
        Nuevas: d.inserted,
        Actualizadas: d.updated,
        "Sin cambios": d.unchanged,
        ...(sheet === "inventory" ? { "Se reemplazan": d.missing } : {}),
      };
    }),
  );

  if (preview.previousImportAt) {
    console.log(`Este archivo ya se importó el ${preview.previousImportAt.toISOString()}.`);
  }
  if (preview.noop) {
    const addedRules = await seedCycleRules(db, rules);
    console.log(
      addedRules > 0
        ? `Sin cambios en los datos; se agregaron ${addedRules} reglas de ciclo.`
        : "Sin cambios: no se escribe nada.",
    );
    process.exit(0);
  }

  const { importId } = await commitImport(db, config, rules, parsed, preview, basename(filePath));
  console.log(`Importación #${importId} confirmada.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
