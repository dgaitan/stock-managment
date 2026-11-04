// Validación compartida (cliente y servidor) de lo que envía el diálogo «Calcular pedido».
import { z } from "zod";
import { proposalSchema } from "@/lib/ai/considerations";

export const calculationRequestSchema = z.object({
  excludedRuleIds: z.array(z.number().int().positive()).max(500),
  // Texto del planificador y su interpretación ya mostrada en «Confirmar»; el servidor la revalida.
  considerations: z
    .object({
      text: z.string().trim().min(1).max(4000),
      demandFactors: proposalSchema.shape.demandFactors,
      excludedModels: proposalSchema.shape.excludedModels,
    })
    .nullable(),
  saveAsBulletin: z.boolean(),
});
export type CalculationRequest = z.infer<typeof calculationRequestSchema>;

export const considerationTextSchema = z.string().trim().min(1, "Escribe una consideración").max(4000, "Máximo 4,000 caracteres");
