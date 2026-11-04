import { describe, expect, it } from "vitest";
import { allocateProportionally, suggestVersionMix } from "@/lib/engine/versionmix";
import type { EngineFactoryOrder, EngineLead, EngineSale } from "@/lib/engine/inputs";

const sale = (date: string, version: string, units: number, extra: Partial<EngineSale> = {}): EngineSale => ({
  date,
  modelName: "Rush",
  version,
  units,
  isFleetOutlier: false,
  ...extra,
});
const lostLead = (closedAt: string, version: string, units = 1): EngineLead => ({
  closedAt,
  modelName: "Rush",
  version,
  units,
  result: "Perdida",
  lossReasonCategory: "stock",
  boughtModelName: null,
});

describe("allocateProportionally", () => {
  it("conserva el total y reparte por mayor resto", () => {
    expect(allocateProportionally(44, [69, 53])).toEqual([25, 19]);
    expect(allocateProportionally(10, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(10);
  });
  it("devuelve ceros sin pedido o sin pesos", () => {
    expect(allocateProportionally(0, [3, 1])).toEqual([0, 0]);
    expect(allocateProportionally(5, [0, 0])).toEqual([0, 0]);
  });
});

describe("suggestVersionMix", () => {
  const cutoff = "2026-09-30";
  const base = { modelName: "Rush", cutoffDate: cutoff, windowMonths: 12, factoryOrders: [] as EngineFactoryOrder[] };

  it("suma ventas y leads perdidos por stock de los últimos 12 meses y reparte el pedido", () => {
    const rows = suggestVersionMix({
      ...base,
      orderUnits: 44,
      sales: [sale("2026-01-15", "AT", 46), sale("2026-02-15", "MT", 42)],
      leads: [lostLead("2026-08-10", "AT", 23), lostLead("2026-08-12", "MT", 11)],
    });
    expect(rows.map((r) => [r.version, r.suggested])).toEqual([
      ["AT", 25],
      ["MT", 19],
    ]);
    expect(rows[0]).toMatchObject({ salesInWindow: 46, lostByStockInWindow: 23 });
  });

  it("ignora flotas, ventas fuera de la ventana y otros motivos de pérdida", () => {
    const rows = suggestVersionMix({
      ...base,
      orderUnits: 8,
      sales: [
        sale("2026-01-15", "AT", 10),
        sale("2026-02-15", "MT", 99, { isFleetOutlier: true }),
        sale("2025-08-15", "MT", 99),
      ],
      leads: [{ ...lostLead("2026-08-10", "MT", 50), lossReasonCategory: "price" }],
    });
    expect(rows.find((r) => r.version === "AT")?.suggested).toBe(8);
    expect(rows.reduce((acc, r) => acc + r.suggested, 0)).toBe(8);
  });
});
