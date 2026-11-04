// Validación compartida entre el formulario (cliente) y las Server Actions.
import { z } from "zod";

export const bulletinInputSchema = z
  .object({
    id: z.number().int().positive().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    issuer: z.string().trim().max(120).nullable(),
    subject: z.string().trim().min(1, "El asunto es obligatorio").max(200),
    body: z.string().trim().min(1, "El texto del comunicado es obligatorio").max(20000),
    scope: z.enum(["permanent", "cycle"]),
    cycle: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Usa el formato AAAA-MM").nullable(),
  })
  .refine((b) => b.scope === "permanent" || b.cycle !== null, {
    path: ["cycle"],
    message: "Indica la ventana (AAAA-MM) a la que aplica",
  });
export type BulletinInput = z.infer<typeof bulletinInputSchema>;

export const ruleSchema = z.object({
  model: z.string().min(1),
  key: z.string().min(1),
  value: z.string().min(1),
});
export const saveRulesSchema = z.object({
  bulletinId: z.number().int().positive(),
  rules: z.array(ruleSchema).max(200),
});
