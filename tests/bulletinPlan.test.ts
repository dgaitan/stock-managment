import { describe, expect, it } from "vitest";
import { planBulletinUpdate, ruleCycle } from "@/lib/bulletins/plan";
import type { BulletinInput } from "@/lib/bulletins/schemas";
import { ruleId } from "@/lib/ai/ruleExtraction";

const input: BulletinInput = {
  id: 1,
  date: "2026-01-01",
  issuer: null,
  subject: "Asunto nuevo",
  body: "Texto",
  scope: "permanent",
  cycle: null,
};

describe("ruleCycle", () => {
  it("una vigencia permanente usa permanent y una por ventana usa su ventana", () => {
    expect(ruleCycle({ scope: "permanent", cycle: null })).toBe("permanent");
    expect(ruleCycle({ scope: "cycle", cycle: "2026-10" })).toBe("2026-10");
    expect(ruleCycle({ scope: "cycle", cycle: null })).toBe("permanent");
  });
});

describe("planBulletinUpdate", () => {
  const existing = { source: "user" as const, date: "2025-06-03", subject: "Lotes", scope: "permanent" as const, cycle: null };

  it("un comunicado propio puede cambiar fecha y asunto; sin cambio de vigencia no se tocan las reglas", () => {
    expect(planBulletinUpdate(existing, input)).toEqual({
      cycle: null,
      date: "2026-01-01",
      subject: "Asunto nuevo",
      vigenciaChanged: false,
    });
  });

  it("fecha y asunto de un comunicado del Excel quedan congelados", () => {
    const plan = planBulletinUpdate({ ...existing, source: "excel" }, input);
    expect(plan.date).toBe("2025-06-03");
    expect(plan.subject).toBe("Lotes");
  });

  it("cambiar de permanente a ventana, o de ventana, marca la vigencia como cambiada", () => {
    expect(planBulletinUpdate(existing, { ...input, scope: "cycle", cycle: "2026-10" }).vigenciaChanged).toBe(true);
    const inWindow = { ...existing, scope: "cycle" as const, cycle: "2026-10" };
    expect(planBulletinUpdate(inWindow, { ...input, scope: "cycle", cycle: "2026-10" }).vigenciaChanged).toBe(false);
    expect(planBulletinUpdate(inWindow, { ...input, scope: "cycle", cycle: "2027-01" }).vigenciaChanged).toBe(true);
  });

  it("al pasar a permanente descarta la ventana", () => {
    const inWindow = { ...existing, scope: "cycle" as const, cycle: "2026-10" };
    expect(planBulletinUpdate(inWindow, { ...input, scope: "permanent", cycle: "2026-10" }).cycle).toBeNull();
  });
});

describe("ruleId", () => {
  it("distingue modelo y clave sin ambigüedad", () => {
    expect(ruleId("Hilux", "lot_min")).not.toBe(ruleId("Hilux lot", "_min"));
  });
});
