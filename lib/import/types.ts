import type { ImportDiff } from "@/lib/import/diff";

/** Lo que el drawer «Importar Excel» muestra antes de confirmar (serializable). */
export interface ImportPreviewView {
  filename: string;
  cutoffDate: string | null;
  window: string | null; // ventana de pedido que corresponde a ese corte (AAAA-MM)
  previousImportAt: string | null; // ISO, si este mismo archivo ya se importó
  noop: boolean;
  diff: ImportDiff;
  warnings: string[]; // filas que se guardan pero no entran al cálculo; confirmar exige aceptarlas
  cleaning: {
    models: number;
    duplicateInvoices: number;
    creditNotes: number;
    duplicateLeads: number;
  };
}
