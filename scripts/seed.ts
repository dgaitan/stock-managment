import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadCycleConfig, loadCycleRules } from "@/lib/engine/config";
import { modelNamesFromRules } from "@/lib/engine/rules";
import { parseExcelFile } from "@/lib/sources/excel";
import { db } from "@/lib/db/client";
import { seedCycleRules } from "@/lib/db/seedCatalog";
import { commitImport, previewImport } from "@/lib/db/importWorkbook";
import type { ImportDiff, ImportMode } from "@/lib/import/diff";

const ACCEPT_WARNINGS_FLAG = "--aceptar-advertencias";
const MERGE_FLAG = "--combinar"; // agrega y actualiza sin eliminar (por defecto se reemplazan las hojas del archivo)

import { SHEET_LABELS } from "@/lib/import/labels";

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--")) ?? "data/seed/caso1.xlsx";
  const acceptWarnings = args.includes(ACCEPT_WARNINGS_FLAG);
  const mode: ImportMode = args.includes(MERGE_FLAG) ? "merge" : "replace";
  const config = loadCycleConfig();
  const rules = loadCycleRules();

  const parsed = parseExcelFile(filePath, modelNamesFromRules(rules), {
    fleetOutlierMinUnits: config.fleet_outlier_min_units,
  });
  const preview = await previewImport(db, config, parsed, readFileSync(filePath), mode);

  console.log("--- Reporte de importación ---");
  console.log(`Modo: ${mode === "replace" ? "reemplazar datos" : `agregar y actualizar (${MERGE_FLAG})`}`);
  console.log(`Corte detectado: ${preview.cutoffDate ?? "sin inventario"}`);
  console.log(`Modelos detectados en ventas: ${parsed.stats.modelosDetectados}`);
  console.log(`Filas de venta leídas: ${parsed.stats.ventasFilasLeidas}`);
  console.log(`Duplicados eliminados: ${parsed.stats.ventasDuplicadosEliminados}`);
  console.log(`Notas de crédito aplicadas: ${parsed.stats.ventasNotasCreditoAplicadas}`);
  console.log(`Leads duplicados eliminados: ${parsed.stats.leadsDuplicadosEliminados}`);

  console.log("\n--- Qué cambia en la base ---");
  console.table(
    (Object.keys(SHEET_LABELS) as (keyof ImportDiff)[]).map((sheet) => {
      const d = preview.diff[sheet];
      return {
        Hoja: SHEET_LABELS[sheet],
        Nuevas: d.inserted,
        Actualizadas: d.updated,
        "Sin cambios": d.unchanged,
        "Se eliminan": d.deleted,
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

  if (preview.warnings.length > 0) {
    console.log("\n--- Advertencias ---");
    for (const warning of preview.warnings) console.log(`- ${warning}`);
    if (!acceptWarnings) {
      console.log(`No se escribió nada. Corrige el archivo o vuelve a correr con ${ACCEPT_WARNINGS_FLAG}.`);
      process.exit(1);
    }
  }

  const { importId } = await commitImport(db, config, rules, parsed, preview, basename(filePath), mode);
  console.log(`Importación #${importId} confirmada.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
