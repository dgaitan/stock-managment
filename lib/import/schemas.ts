import { z } from "zod";

// Debe ser igual a experimental.serverActions.bodySizeLimit en next.config.ts.
export const MAX_WORKBOOK_BYTES = 4 * 1024 * 1024; // por debajo del límite de cuerpo de Vercel (4.5 MB)

export const workbookFileSchema = z
  .instanceof(File, { message: "Elige un archivo Excel." })
  .refine((file) => file.name.toLowerCase().endsWith(".xlsx"), "El archivo debe ser .xlsx.")
  .refine((file) => file.size > 0, "El archivo está vacío.")
  .refine((file) => file.size <= MAX_WORKBOOK_BYTES, "El archivo pesa más de 4 MB.");
