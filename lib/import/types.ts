import type { ImportDiff } from "@/lib/import/diff";

/** Lo que el drawer «Importar Excel» muestra antes de confirmar (serializable). */
export interface ImportPreviewView {
  filename: string;
  cutoffDate: string | null;
  previousImportAt: string | null; // ISO, si este mismo archivo ya se importó
  noop: boolean;
  diff: ImportDiff;
  cleaning: {
    models: number;
    duplicateInvoices: number;
    creditNotes: number;
    duplicateLeads: number;
    unmappedModels: string[];
  };
}
