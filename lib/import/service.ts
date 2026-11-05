import "server-only";
import * as XLSX from "xlsx";
import { UserFacingError } from "@/lib/bulletins/service";
import { db } from "@/lib/db/client";
import { commitImport, previewImport } from "@/lib/db/importWorkbook";
import { seedCycleRules } from "@/lib/db/seedCatalog";
import { loadCycleConfig, loadCycleRules } from "@/lib/engine/config";
import { deriveCycle } from "@/lib/engine/cycle";
import { modelNamesFromRules } from "@/lib/engine/rules";
import type { ImportMode } from "@/lib/import/diff";
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

export async function previewWorkbook(bytes: Uint8Array, filename: string, mode: ImportMode): Promise<ImportPreviewView> {
  const config = loadCycleConfig();
  const parsed = parse(bytes);
  const preview = await previewImport(db, config, parsed, bytes, mode);
  const { stats } = parsed;
  const window = preview.cutoffDate
    ? deriveCycle({ cutoffDate: preview.cutoffDate, leadTimeMonths: config.lead_time_months, windowMonths: config.window_months }).window
    : null;
  return {
    filename,
    cutoffDate: preview.cutoffDate,
    window,
    previousImportAt: preview.previousImportAt?.toISOString() ?? null,
    noop: preview.noop,
    diff: preview.diff,
    warnings: preview.warnings,
    cleaning: {
      models: stats.modelosDetectados,
      duplicateInvoices: stats.ventasDuplicadosEliminados,
      creditNotes: stats.ventasNotasCreditoAplicadas,
      duplicateLeads: stats.leadsDuplicadosEliminados,
    },
  };
}

/**
 * Escribe en una transacción. Sin cambios en los datos solo completa las reglas de
 * ciclo que falten. Con advertencias (filas que no entran al cálculo) exige que el
 * usuario las haya aceptado en la vista previa.
 */
export async function confirmWorkbook(
  bytes: Uint8Array,
  filename: string,
  mode: ImportMode,
  acceptWarnings: boolean,
): Promise<{ noop: boolean }> {
  const config = loadCycleConfig();
  const rules = loadCycleRules();
  const parsed = parse(bytes);
  const preview = await previewImport(db, config, parsed, bytes, mode);
  if (preview.noop) {
    await seedCycleRules(db, rules);
    return { noop: true };
  }
  if (!acceptWarnings && preview.warnings.length > 0) {
    throw new UserFacingError("El archivo tiene advertencias: acéptalas para importar.");
  }
  await commitImport(db, config, rules, parsed, preview, filename, mode);
  return { noop: false };
}
