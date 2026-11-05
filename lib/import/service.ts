import "server-only";
import * as XLSX from "xlsx";
import { UserFacingError } from "@/lib/bulletins/service";
import { db } from "@/lib/db/client";
import { commitImport, previewImport } from "@/lib/db/importWorkbook";
import { seedCycleRules } from "@/lib/db/seedCatalog";
import { loadCycleConfig, loadCycleRules } from "@/lib/engine/config";
import { modelNamesFromRules } from "@/lib/engine/rules";
import type { ImportPreviewView } from "@/lib/import/types";
import { parseWorkbook } from "@/lib/sources/excel";
import type { NormalizedImport } from "@/lib/sources/types";

// La importación es sin estado: la vista previa y la confirmación reciben el mismo
// archivo y recalculan, así que no hay que guardar nada entre ambos pasos.

function parse(bytes: Uint8Array): NormalizedImport {
  const config = loadCycleConfig();
  const rules = loadCycleRules();
  try {
    const workbook = XLSX.read(bytes, { type: "array" });
    return parseWorkbook(workbook, modelNamesFromRules(rules), { fleetOutlierMinUnits: config.fleet_outlier_min_units });
  } catch {
    throw new UserFacingError("No se pudo leer el Excel. Revisa que tenga las hojas del caso.");
  }
}

export async function previewWorkbook(bytes: Uint8Array, filename: string): Promise<ImportPreviewView> {
  const parsed = parse(bytes);
  const preview = await previewImport(db, parsed, bytes);
  const { stats } = parsed;
  return {
    filename,
    cutoffDate: preview.cutoffDate,
    previousImportAt: preview.previousImportAt?.toISOString() ?? null,
    noop: preview.noop,
    diff: preview.diff,
    cleaning: {
      models: stats.modelosDetectados,
      duplicateInvoices: stats.ventasDuplicadosEliminados,
      creditNotes: stats.ventasNotasCreditoAplicadas,
      duplicateLeads: stats.leadsDuplicadosEliminados,
      unmappedModels: stats.modelosNoMapeados,
    },
  };
}

/** Escribe en una transacción. Sin cambios en los datos solo completa las reglas de ciclo que falten. */
export async function confirmWorkbook(bytes: Uint8Array, filename: string): Promise<{ noop: boolean }> {
  const config = loadCycleConfig();
  const rules = loadCycleRules();
  const parsed = parse(bytes);
  const preview = await previewImport(db, parsed, bytes);
  if (preview.noop) {
    await seedCycleRules(db, rules);
    return { noop: true };
  }
  await commitImport(db, config, rules, parsed, preview, filename);
  return { noop: false };
}
