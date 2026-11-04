import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Database } from "@/lib/db/factRows";
import { loadEngineInputs } from "@/lib/db/loadEngineInputs";
import type { CycleConfig } from "@/lib/engine/config";

// Base falsa: select().from(tabla) devuelve las filas de esa tabla; where() no filtra,
// así que la tabla bulletins contiene solo los comunicados archivados (lo que pide el cargador).
function fakeDb(tables: Map<unknown, unknown[]>): Database {
  return {
    select: () => ({
      from: (table: unknown) => {
        const rows = Promise.resolve(tables.get(table) ?? []);
        return Object.assign(rows, { where: () => rows });
      },
    }),
  } as unknown as Database;
}

const config = { lead_time_months: 4, window_months: [1, 4, 7, 10] } as CycleConfig;

describe("loadEngineInputs", () => {
  const tables = new Map<unknown, unknown[]>([
    [schema.models, [
      { id: 1, name: "Hilux", unitCost: "38000.50", marginPct: "0.0800", monthlyFinCost: "120.00" },
      { id: 2, name: "RAV4", unitCost: "30000.00", marginPct: "0.0700", monthlyFinCost: "90.00" },
    ]],
    [schema.lossReasons, [{ id: 7, category: "stock" }]],
    [schema.sales, [{ date: "2026-09-10", modelId: 1, units: 3, isFleetOutlier: false }]],
    [schema.leads, [
      { closedAt: "2026-09-05", modelId: 1, units: 1, result: "Perdida", reasonId: 7, boughtModelId: 2 },
      { closedAt: null, modelId: 99, units: 1, result: null, reasonId: null, boughtModelId: null },
    ]],
    [schema.inventorySnapshots, [{ monthEnd: "2026-09-30", modelId: 1, units: 5 }]],
    [schema.factoryOrders, [{ modelId: 1, orderDate: "2026-08-01", units: 6, eta: "2026-11-15", receivedAt: null }]],
    [schema.cycleRules, [
      { cycle: "permanent", modelId: 1, key: "lot_min", value: "12" },
      { cycle: "permanent", modelId: 1, key: "lot_multiple", value: "6" },
      { cycle: "permanent", modelId: 2, key: "lot_min", value: "4" },
      { cycle: "permanent", modelId: 2, key: "lot_multiple", value: "4" },
      { cycle: "2026-10", modelId: 2, key: "lifecycle", value: "last_window" },
      { cycle: "permanent", modelId: 404, key: "lot_min", value: "1" }, // modelo inexistente: se descarta
    ]],
  ]);

  it("traduce ids a nombres, categorías de pérdida y números de economía", async () => {
    const inputs = await loadEngineInputs(fakeDb(tables), config);
    expect(inputs.data.leads[0]).toMatchObject({ modelName: "Hilux", boughtModelName: "RAV4", lossReasonCategory: "stock" });
    expect(inputs.data.leads[1]).toMatchObject({ modelName: null, lossReasonCategory: null });
    expect(inputs.economicsByModel.get("Hilux")).toEqual({ unitCost: 38000.5, marginPct: 0.08, monthlyFinCost: 120 });
    expect(inputs.data.factoryOrders[0]).toMatchObject({ modelName: "Hilux", eta: "2026-11-15", receivedAt: null });
  });

  it("no aplica las reglas de un comunicado archivado", async () => {
    const withArchived = new Map(tables);
    withArchived.set(schema.bulletins, [{ id: 10 }]);
    withArchived.set(schema.cycleRules, [
      { cycle: "permanent", modelId: 1, key: "lot_min", value: "12", bulletinId: null },
      { cycle: "permanent", modelId: 1, key: "lot_multiple", value: "6", bulletinId: null },
      { cycle: "permanent", modelId: 2, key: "lot_min", value: "4", bulletinId: null },
      { cycle: "permanent", modelId: 2, key: "lot_multiple", value: "4", bulletinId: null },
      { cycle: "2026-10", modelId: 2, key: "lifecycle", value: "last_window", bulletinId: 10 },
    ]);
    const inputs = await loadEngineInputs(fakeDb(withArchived), config);
    expect(inputs.rules).toHaveLength(4);
    expect(inputs.models.find((m) => m.name === "RAV4")?.lifecycle).toBeUndefined();
  });

  it("omite solo en este cálculo las reglas pedidas por id", async () => {
    const withIds = new Map(tables);
    withIds.set(schema.cycleRules, [
      { id: 1, cycle: "permanent", modelId: 2, key: "lot_min", value: "4", bulletinId: null },
      { id: 2, cycle: "permanent", modelId: 2, key: "lot_multiple", value: "4", bulletinId: null },
      { id: 3, cycle: "2026-10", modelId: 2, key: "lifecycle", value: "last_window", bulletinId: null },
    ]);
    const base = await loadEngineInputs(fakeDb(withIds), config);
    const omitted = await loadEngineInputs(fakeDb(withIds), config, { excludedRuleIds: [3] });
    expect(base.models.find((m) => m.name === "RAV4")?.lifecycle).toBe("last_window");
    expect(omitted.models.find((m) => m.name === "RAV4")?.lifecycle).toBeUndefined();
    expect(omitted.rules).toHaveLength(2);
  });

  it("deriva el ciclo del último cierre y resuelve las reglas vigentes de esa ventana", async () => {
    const inputs = await loadEngineInputs(fakeDb(tables), config);
    expect(inputs.cycle.cutoffDate).toBe("2026-09-30");
    expect(inputs.cycle.window).toBe("2026-10");
    expect(inputs.rules).toHaveLength(5);
    expect(inputs.models.find((m) => m.name === "RAV4")).toMatchObject({ lot_min: 4, lifecycle: "last_window" });
    expect(inputs.models.find((m) => m.name === "Hilux")?.lifecycle).toBeUndefined();
  });
});
