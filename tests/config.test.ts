import { describe, expect, it } from "vitest";
import { loadCycleConfig, loadCycleRules } from "@/lib/engine/config";
import { PERMANENT_CYCLE, resolveModelConfigs } from "@/lib/engine/rules";

describe("config/cycle.yaml", () => {
  it("trae solo supuestos de pronóstico: nada que cambie por ciclo", () => {
    const config = loadCycleConfig() as unknown as Record<string, unknown>;
    expect(config.window_months).toEqual([1, 4, 7, 10]);
    for (const perCycle of ["cutoff_date", "order_window_closes", "order_coverage_months", "models"]) {
      expect(config).not.toHaveProperty(perCycle);
    }
  });
});

describe("config/cycle_rules.yaml", () => {
  const rules = loadCycleRules();

  it("aplana el árbol ciclo -> modelo -> clave en filas de cycle_rules", () => {
    expect(rules).toContainEqual({ cycle: PERMANENT_CYCLE, model: "Hilux", key: "lot_min", value: "12" });
    expect(rules).toContainEqual({ cycle: "2026-10", model: "RAV4", key: "lifecycle", value: "last_window" });
  });

  it("la ventana 2026-10 resuelve los 11 modelos con lote y RAV4 en su última ventana", () => {
    const models = resolveModelConfigs(rules, "2026-10");
    expect(models).toHaveLength(11);
    const rav4 = models.find((m) => m.name === "RAV4");
    expect(rav4).toMatchObject({ lot_min: 4, lot_multiple: 4, lifecycle: "last_window", safety_stock_override: 0 });
  });

  it("la regla de RAV4 no se arrastra a la ventana siguiente", () => {
    const rav4 = resolveModelConfigs(rules, "2027-01").find((m) => m.name === "RAV4");
    expect(rav4?.lifecycle).toBeUndefined();
    expect(rav4?.safety_stock_override).toBeUndefined();
    expect(rav4?.lot_min).toBe(4);
  });
});
