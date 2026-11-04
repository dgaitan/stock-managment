import { describe, expect, it } from "vitest";
import { loadCycleConfig } from "@/lib/engine/config";

describe("config/cycle.yaml", () => {
  it("carga los 11 modelos con lote y minimo", () => {
    const config = loadCycleConfig();
    expect(config.models).toHaveLength(11);
    for (const model of config.models) {
      expect(model.lot_min).toBeGreaterThan(0);
      expect(model.lot_multiple).toBeGreaterThan(0);
    }
  });

  it("RAV4 tiene lifecycle last_window", () => {
    const config = loadCycleConfig();
    const rav4 = config.models.find((m) => m.name === "RAV4");
    expect(rav4?.lifecycle).toBe("last_window");
  });
});
