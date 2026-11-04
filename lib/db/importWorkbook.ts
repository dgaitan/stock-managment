import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { applyImport } from "@/lib/db/applyImport";
import { buildFactRows, type Database } from "@/lib/db/factRows";
import { diffImport } from "@/lib/db/importDiff";
import { seedCatalog, seedCycleRules } from "@/lib/db/seedCatalog";
import type { CycleConfig } from "@/lib/engine/config";
import { modelNamesFromRules, type CycleRuleRow } from "@/lib/engine/rules";
import { isNoop, type ImportDiff } from "@/lib/import/diff";
import type { NormalizedImport } from "@/lib/sources/types";

// Orquesta una importación en dos tiempos: vista previa (solo lee) y confirmar
// (escribe). La usan la CLI `bun run seed` y, en la app, el drawer «Importar Excel».

export interface ImportPreview {
  fileSha256: string;
  cutoffDate: string | null; // último cierre de inventario del archivo
  diff: ImportDiff;
  noop: boolean;
  previousImportAt: Date | null; // si este mismo archivo ya se importó
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function previewImport(db: Database, parsed: NormalizedImport, fileBytes: Uint8Array): Promise<ImportPreview> {
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
  const diff = await diffImport(db, rows, parsed.economics);
  return {
    fileSha256,
    cutoffDate: rows.inventoryMonths.at(-1) ?? null,
    diff,
    noop: isNoop(diff),
    previousImportAt: previous[0]?.uploadedAt ?? null,
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
): Promise<{ importId: number; diff: ImportDiff }> {
  return db.transaction(async (tx) => {
    await seedCatalog(tx, config, modelNamesFromRules(rules), parsed);
    await seedCycleRules(tx, rules);
    const rows = await buildFactRows(tx, parsed);
    const diff = await diffImport(tx, rows, parsed.economics);
    await applyImport(tx, rows);
    const [record] = await tx
      .insert(schema.imports)
      .values({
        filename,
        status: "ok",
        fileSha256: preview.fileSha256,
        cutoffDate: rows.inventoryMonths.at(-1) ?? null,
        statsJson: { ...parsed.stats, diff },
      })
      .returning({ id: schema.imports.id });
    return { importId: record.id, diff };
  });
}
