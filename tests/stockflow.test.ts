import { describe, expect, it } from "vitest";
import { buildMonthlyStockFlow, computeAvgMonthlyNetSales } from "@/lib/engine/stockflow";
import type {
  NormalizedFactoryOrder,
  NormalizedInventorySnapshot,
  NormalizedLead,
  NormalizedSale,
} from "@/lib/sources/types";

function sale(partial: Partial<NormalizedSale>): NormalizedSale {
  return {
    invoice: "FAC-1",
    lineHash: Math.random().toString(),
    date: "2026-01-15",
    branchNameRaw: null,
    branchName: null,
    seller: null,
    customerType: "Individual",
    customer: null,
    modelNameRaw: "Hilux",
    modelName: "Hilux",
    version: null,
    color: null,
    units: 1,
    unitPrice: null,
    note: null,
    isCreditNote: false,
    isFleetOutlier: false,
    ...partial,
  };
}

function inv(partial: Partial<NormalizedInventorySnapshot>): NormalizedInventorySnapshot {
  return {
    monthEnd: "2026-01-31",
    modelNameRaw: "Hilux",
    modelName: "Hilux",
    version: null,
    color: null,
    units: 0,
    avgAgeDays: null,
    ...partial,
  };
}

describe("computeAvgMonthlyNetSales", () => {
  it("promedia ventas netas sin flota, por mes", () => {
    const sales = [
      sale({ date: "2026-01-10", units: 4 }),
      sale({ date: "2026-02-10", units: 2 }),
      sale({ date: "2026-02-20", units: 40, customerType: "Flota / Institucional", isFleetOutlier: true }),
    ];
    expect(computeAvgMonthlyNetSales("Hilux", sales)).toBe(3); // (4 + 2) / 2 meses
  });
});

describe("buildMonthlyStockFlow", () => {
  it("cuadra el flujo cuando inventario, llegadas y ventas coinciden", () => {
    const sales = [sale({ date: "2026-02-10", units: 3 })];
    const inventory = [inv({ monthEnd: "2026-01-31", units: 10 }), inv({ monthEnd: "2026-02-28", units: 12 })];
    const factoryOrders: NormalizedFactoryOrder[] = [
      {
        orderNo: "PF-1",
        lineHash: "h1",
        orderDate: "2025-10-01",
        modelNameRaw: "Hilux",
        modelName: "Hilux",
        version: null,
        color: null,
        units: 5,
        eta: "2026-02-15",
        status: "Recibido",
        receivedAt: "2026-02-15",
      },
    ];

    const flow = buildMonthlyStockFlow({ modelName: "Hilux", sales, inventory, factoryOrders, leads: [] });
    const feb = flow.find((m) => m.month === "2026-02")!;

    expect(feb.openingStock).toBe(10);
    expect(feb.arrivals).toBe(5);
    expect(feb.netSalesUnits).toBe(3);
    expect(feb.closingStockExpected).toBe(12); // 10 + 5 - 3
    expect(feb.discrepancy).toBe(0);
  });

  it("reporta una discrepancia como alerta de calidad cuando el flujo no cuadra", () => {
    const sales = [sale({ date: "2026-02-10", units: 3 })];
    const inventory = [inv({ monthEnd: "2026-01-31", units: 10 }), inv({ monthEnd: "2026-02-28", units: 20 })];

    const flow = buildMonthlyStockFlow({ modelName: "Hilux", sales, inventory, factoryOrders: [], leads: [] });
    const feb = flow.find((m) => m.month === "2026-02")!;

    expect(feb.closingStockExpected).toBe(7); // 10 + 0 - 3
    expect(feb.discrepancy).toBe(13); // 20 reportado - 7 esperado
  });

  it("marca quiebre cuando el cierre es 0", () => {
    const inventory = [inv({ monthEnd: "2026-01-31", units: 0 })];
    const flow = buildMonthlyStockFlow({ modelName: "Hilux", sales: [], inventory, factoryOrders: [], leads: [] });
    expect(flow[0].isStockout).toBe(true);
  });

  it("marca quiebre cuando hay leads perdidos por falta de stock en el mes", () => {
    const inventory = [inv({ monthEnd: "2026-01-31", units: 50 })];
    const leads: NormalizedLead[] = [
      {
        externalId: "OPP-1",
        createdAt: "2026-01-05",
        closedAt: "2026-01-10",
        branchNameRaw: null,
        branchName: null,
        seller: null,
        customerType: "Individual",
        modelNameRaw: "Hilux",
        modelName: "Hilux",
        version: null,
        units: 1,
        result: "Perdida",
        lossReasonRaw: "Sin stock",
        lossReasonCategory: "stock",
        boughtModelNameRaw: null,
        boughtModelName: null,
        boughtVersion: null,
      },
    ];
    const flow = buildMonthlyStockFlow({ modelName: "Hilux", sales: [], inventory, factoryOrders: [], leads });
    expect(flow[0].leadsLostStock).toBe(1);
    expect(flow[0].isStockout).toBe(true);
  });

  it("no cuadra el primer mes de la serie (sin mes anterior)", () => {
    const inventory = [inv({ monthEnd: "2026-01-31", units: 10 })];
    const flow = buildMonthlyStockFlow({ modelName: "Hilux", sales: [], inventory, factoryOrders: [], leads: [] });
    expect(flow[0].openingStock).toBeNull();
    expect(flow[0].closingStockExpected).toBeNull();
    expect(flow[0].discrepancy).toBeNull();
  });
});
