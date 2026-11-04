import { describe, expect, it } from "vitest";
import { bulletinInputSchema, saveRulesSchema } from "@/lib/bulletins/schemas";

const valid = {
  id: null,
  date: "2026-09-15",
  issuer: null,
  subject: "Lanzamiento RAV4",
  body: "Texto",
  scope: "cycle" as const,
  cycle: "2026-10",
};

describe("bulletinInputSchema", () => {
  it("acepta un comunicado de una ventana", () => {
    expect(bulletinInputSchema.safeParse(valid).success).toBe(true);
  });

  it("una vigencia por ventana exige la ventana, una permanente no", () => {
    const withoutCycle = bulletinInputSchema.safeParse({ ...valid, cycle: null });
    expect(withoutCycle.success).toBe(false);
    expect(bulletinInputSchema.safeParse({ ...valid, scope: "permanent", cycle: null }).success).toBe(true);
  });

  it("rechaza fecha, ventana, asunto o texto inválidos", () => {
    expect(bulletinInputSchema.safeParse({ ...valid, date: "15/09/2026" }).success).toBe(false);
    expect(bulletinInputSchema.safeParse({ ...valid, cycle: "oct-2026" }).success).toBe(false);
    expect(bulletinInputSchema.safeParse({ ...valid, cycle: "2026-13" }).success).toBe(false);
    expect(bulletinInputSchema.safeParse({ ...valid, subject: "   " }).success).toBe(false);
    expect(bulletinInputSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
  });
});

describe("saveRulesSchema", () => {
  it("exige un id válido y reglas con modelo, clave y valor", () => {
    expect(saveRulesSchema.safeParse({ bulletinId: 1, rules: [{ model: "Hilux", key: "lot_min", value: "12" }] }).success).toBe(true);
    expect(saveRulesSchema.safeParse({ bulletinId: 0, rules: [] }).success).toBe(false);
    expect(saveRulesSchema.safeParse({ bulletinId: 1, rules: [{ model: "Hilux", key: "", value: "1" }] }).success).toBe(false);
  });
});
