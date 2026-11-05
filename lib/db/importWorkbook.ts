import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { applyImport } from "@/lib/db/applyImport";
import { buildFactRows, type Database } from "@/lib/db/factRows";
import { diffImport } from "@/lib/db/importDiff";
import { seedCatalog, seedCycleRules } from "@/lib/db/seedCatalog";
import type { CycleConfig } from "@/lib/engine/config";
import { modelNamesFromRules, type CycleRuleRow } from "@/lib/engine/rules";
import { isNoop, type ImportDiff, type ImportMode } from "@/lib/import/diff";
import { importWarnings } from "@/lib/import/warnings";
import type { NormalizedImport } from "@/lib/sources/types";

// Orquesta una importación en dos tiempos: vista previa (solo lee) y confirmar
// (escribe). La usan la CLI `bun run seed` y, en la app, el drawer «Importar Excel».

export interface ImportPreview {
  fileSha256: string;
  cutoffDate: string | null; // último cierre de inventario del archivo
  diff: ImportDiff;
  noop: boolean;
  previousImportAt: Date | null; // si este mismo archivo ya se importó
  warnings: string[]; // filas que no entran al cálculo o historia insuficiente; confirmar exige aceptarlas
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function previewImport(
  db: Database,
  config: CycleConfig,
  parsed: NormalizedImport,
  fileBytes: Uint8Array,
  mode: ImportMode,
): Promise<ImportPreview> {
  const fileSha256 = sha256(fileBytes);
  const [rows, previous] = await Promise.all([
    buildFactRows(db, parsed),
    db
      .select({ uploadedAt: schema.imports.uploadedAt })
      .from(schema.imports)
      .where(eq(schema.imports.fileSha256, fileSha256))
      .orderBy(desc(schema.imports.uploadedAt))
      .limit(1),
  ]);
  const { diff, history } = await diffImport(db, rows, parsed.economics, parsed.present, mode);
  return {
    fileSha256,
    cutoffDate: rows.inventoryMonths.at(-1) ?? null,
    diff,
    noop: isNoop(diff),
    previousImportAt: previous[0]?.uploadedAt ?? null,
    warnings: importWarnings(parsed.stats, { diff, history, minHistoryMonths: config.min_history_months }),
  };
}

/**
 * Confirma la importación en una sola transacción: catálogo, reglas, hechos y registro
 * en `imports`. Si algo falla no queda nada a medias. El registro guarda el diff
 * calculado dentro de la transacción (lo que de verdad se escribió), no el de
 * la vista previa, por si la base cambió entre ambos.
 */
export async function commitImport(
  db: Database,
  config: CycleConfig,
  rules: CycleRuleRow[],
  parsed: NormalizedImport,
  preview: Pick<ImportPreview, "fileSha256">,
  filename: string,
  mode: ImportMode,
): Promise<{ importId: number; diff: ImportDiff }> {
  return db.transaction(async (tx) => {
    await seedCatalog(tx, config, modelNamesFromRules(rules), parsed);
    await seedCycleRules(tx, rules);
    const rows = await buildFactRows(tx, parsed);
    const { diff, deletions } = await diffImport(tx, rows, parsed.economics, parsed.present, mode);
    await applyImport(tx, rows, deletions);
    const [record] = await tx
      .insert(schema.imports)
      .values({
        filename,
        status: "ok",
        fileSha256: preview.fileSha256,
        cutoffDate: rows.inventoryMonths.at(-1) ?? null,
        statsJson: { ...parsed.stats, mode, diff },
      })
      .returning({ id: schema.imports.id });
    return { importId: record.id, diff };
  });
}
