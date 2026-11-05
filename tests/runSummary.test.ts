import { describe, expect, it } from "vitest";
import { describeRunRules, lineChanged, summarizeRun } from "@/lib/orders/runSummary";

describe("describeRunRules", () => {
  it("sin consideraciones ni omisiones", () => {
    expect(describeRunRules(0, 0)).toBe("reglas de los comunicados, sin consideraciones adicionales");
  });
  it("cuenta las reglas del planificador en singular y plural", () => {
    expect(describeRunRules(1, 0)).toBe("reglas de los comunicados + 1 tuya");
    expect(describeRunRules(2, 0)).toBe("reglas de los comunicados + 2 tuyas");
  });
  it("agrega las reglas omitidas", () => {
    expect(describeRunRules(0, 1)).toBe("reglas de los comunicados, sin consideraciones adicionales · 1 omitida");
    expect(describeRunRules(1, 3)).toBe("reglas de los comunicados + 1 tuya · 3 omitidas");
  });
});

describe("summarizeRun", () => {
  const line = (modelName: string, orderUnits: number, previousOrderUnits: number | null) =>
    ({ modelName, orderUnits, previousOrderUnits }) as Parameters<typeof summarizeRun>[0]["lines"][number];

  it("lista solo los modelos que cambiaron, con su diferencia", () => {
    const summary = summarizeRun({
      version: 2,
      totalUnits: 436,
      totalCapital: 100,
      lines: [line("Hilux", 72, 48), line("Rush", 44, 44), line("RAV4", 0, 4)],
    });
    expect(summary.changes).toEqual([
      { model: "Hilux", delta: 24 },
      { model: "RAV4", delta: -4 },
    ]);
  });

  it("sin análisis anterior no hay cambios", () => {
    expect(lineChanged({ orderUnits: 10, previousOrderUnits: null })).toBe(false);
    expect(summarizeRun({ version: 1, totalUnits: 10, totalCapital: 1, lines: [line("Hilux", 10, null)] }).changes).toEqual([]);
  });
});
