import { describe, expect, it } from "vitest";
import { type CycleRuleRow, modelNamesFromRules, PERMANENT_CYCLE, resolveModelConfigs } from "@/lib/engine/rules";

const rule = (cycle: string, model: string, key: string, value: string): CycleRuleRow => ({ cycle, model, key, value });

const LOTS = [
  rule(PERMANENT_CYCLE, "Hilux", "lot_min", "12"),
  rule(PERMANENT_CYCLE, "Hilux", "lot_multiple", "6"),
  rule(PERMANENT_CYCLE, "RAV4", "lot_min", "4"),
  rule(PERMANENT_CYCLE, "RAV4", "lot_multiple", "4"),
];

describe("resolveModelConfigs", () => {
  it("las reglas permanentes aplican en cualquier ventana", () => {
    expect(resolveModelConfigs(LOTS, "2026-10")).toEqual([
      { name: "Hilux", lot_min: 12, lot_multiple: 6 },
      { name: "RAV4", lot_min: 4, lot_multiple: 4 },
    ]);
  });

  it("la regla de un ciclo aplica solo en su ventana", () => {
    const rows = [...LOTS, rule("2026-10", "RAV4", "lifecycle", "last_window"), rule("2026-10", "RAV4", "safety_stock_override", "0")];
    const inWindow = resolveModelConfigs(rows, "2026-10").find((m) => m.name === "RAV4");
    const nextWindow = resolveModelConfigs(rows, "2027-01").find((m) => m.name === "RAV4");
    expect(inWindow).toMatchObject({ lifecycle: "last_window", safety_stock_override: 0 });
    expect(nextWindow).toEqual({ name: "RAV4", lot_min: 4, lot_multiple: 4 });
  });

  it("una regla del ciclo prevalece sobre la permanente", () => {
    const rows = [...LOTS, rule("2027-01", "Hilux", "lot_min", "18")];
    expect(resolveModelConfigs(rows, "2027-01")[0].lot_min).toBe(18);
    expect(resolveModelConfigs(rows, "2026-10")[0].lot_min).toBe(12);
  });

  it("una clave que el motor no conoce es un error, no se ignora", () => {
    expect(() => resolveModelConfigs([...LOTS, rule("2026-10", "Hilux", "tope_capital", "1000000")], "2026-10")).toThrow(/desconocida/);
  });

  it("exige lote mínimo y múltiplo en cada modelo", () => {
    expect(() => resolveModelConfigs([rule(PERMANENT_CYCLE, "Hilux", "lot_min", "12")], "2026-10")).toThrow(/Falta el lote/);
  });

  it("rechaza valores inválidos", () => {
    expect(() => resolveModelConfigs([...LOTS, rule("2026-10", "Hilux", "lot_min", "abc")], "2026-10")).toThrow(/inválida/);
    expect(() => resolveModelConfigs([...LOTS, rule("2026-10", "Hilux", "lot_multiple", "0")], "2026-10")).toThrow(/inválida/);
    expect(() => resolveModelConfigs([...LOTS, rule("2026-10", "Hilux", "lifecycle", "eol")], "2026-10")).toThrow(/lifecycle/);
  });
});

describe("modelNamesFromRules", () => {
  it("lista cada modelo una vez, en orden de aparición", () => {
    expect(modelNamesFromRules([...LOTS, rule("2026-10", "Hilux", "horizon_months", "3")])).toEqual(["Hilux", "RAV4"]);
  });
});
