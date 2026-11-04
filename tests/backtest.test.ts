import { describe, expect, it } from "vitest";
import {
  computeErrorMetrics,
  naiveMonthlyRate,
  runBacktest,
  sliceDataAtCutoff,
  type BacktestData,
} from "@/lib/engine/backtest";
import type { CycleConfig } from "@/lib/engine/config";
import type { NormalizedFactoryOrder, NormalizedLead, NormalizedSale } from "@/lib/sources/types";

function sale(date: string, units: number, extra: Partial<NormalizedSale> = {}): NormalizedSale {
  return {
    invoice: "F",
    businessKey: "bk",
    lineHash: `${date}-${units}`,
    date,
    branchNameRaw: null,
    branchName: null,
    seller: null,
    customerType: "Individual",
    customer: null,
    modelNameRaw: "Hilux",
    modelName: "Hilux",
    version: null,
    color: null,
    units,
    unitPrice: null,
    note: null,
    isCreditNote: false,
    isFleetOutlier: false,
    ...extra,
  };
}

function lead(closedAt: string | null): NormalizedLead {
  return {
    externalId: `L-${closedAt}`,
    lineHash: "lh",
    createdAt: "2025-01-01",
    closedAt,
    branchNameRaw: null,
    branchName: null,
    seller: null,
    customerType: null,
    modelNameRaw: "Hilux",
    modelName: "Hilux",
    version: null,
    units: 1,
    result: "Perdida",
    lossReasonRaw: null,
    lossReasonCategory: "stock",
    boughtModelNameRaw: null,
    boughtModelName: null,
    boughtVersion: null,
  };
}

function order(orderDate: string | null): NormalizedFactoryOrder {
  return {
    orderNo: "PF",
    businessKey: "bk",
    lineHash: `o-${orderDate}`,
    orderDate,
    modelNameRaw: "Hilux",
    modelName: "Hilux",
    version: null,
    color: null,
    units: 6,
    eta: null,
    status: "En tránsito",
    receivedAt: null,
  };
}

describe("sliceDataAtCutoff", () => {
  it("conserva solo lo que se sabía al corte (sin fuga de datos futuros)", () => {
    const data: BacktestData = {
      sales: [sale("2025-06-30", 1), sale("2025-07-01", 2)],
      leads: [lead("2025-06-15"), lead("2025-07-20"), lead(null)],
      inventory: [
        { monthEnd: "2025-06-30", modelName: "Hilux", units: 5 },
        { monthEnd: "2025-07-31", modelName: "Hilux", units: 7 },
      ],
      factoryOrders: [order("2025-06-01"), order("2025-07-15"), order(null)],
    };
    const sliced = sliceDataAtCutoff(data, "2025-06-30");
    expect(sliced.sales.map((s) => s.units)).toEqual([1]);
    expect(sliced.leads).toHaveLength(1);
    expect(sliced.inventory.map((i) => i.units)).toEqual([5]);
    expect(sliced.factoryOrders).toHaveLength(1);
  });
});

describe("naiveMonthlyRate", () => {
  it("promedia las ventas netas sin flota de los 12 meses que terminan en el corte", () => {
    const sales = [
      sale("2025-07-10", 12),
      sale("2026-06-10", 12),
      sale("2026-03-10", 60, { isFleetOutlier: true }), // flota: no cuenta
      sale("2025-06-10", 100), // fuera de la ventana de 12 meses
    ];
    expect(naiveMonthlyRate("Hilux", sales, "2026-06")).toBe(2);
  });
});

describe("computeErrorMetrics", () => {
  it("calcula WAPE y sesgo sobre las sumas, no sobre promedios de porcentajes", () => {
    const result = computeErrorMetrics([
      { forecast: 8, actual: 10 },
      { forecast: 30, actual: 20 },
    ]);
    expect(result.wape).toBeCloseTo(12 / 30, 10); // (2 + 10) / 30
    expect(result.bias).toBeCloseTo(8 / 30, 10); // (-2 + 10) / 30
  });

  it("devuelve null si no hubo demanda real", () => {
    expect(computeErrorMetrics([{ forecast: 5, actual: 0 }])).toEqual({ wape: null, bias: null });
  });
});

describe("runBacktest", () => {
  const config = {
    lead_time_months: 4,
    window_months: [1, 4, 7, 10],
    fleet_outlier_min_units: 10,
    min_order_effective_threshold_pct: 0.5,
    stockout_min_stock_fraction: 0.5,
    forecast_weights: { recent_6m: 0.6, prior_6m: 0.4 },
    seasonality_min_years: 2,
    safety_stock: {
      z_high_margin: 1.65,
      z_mid_margin: 1.28,
      z_low_margin_or_high_fin_cost: 0.84,
      margin_high_threshold_pct: 0.12,
      margin_low_threshold_pct: 0.09,
      high_fin_cost_monthly_threshold: 400,
    },
    plan_piso_monthly_pct: 0.009,
    aging_discounts: {},
    loss_reason_categories: [],
    backtest_cutoffs: ["2026-03-31"],
  } as CycleConfig;

  const models = [{ name: "Hilux", lot_min: 12, lot_multiple: 6 }];

  // 10 u/mes de ene-2025 a sep-2026
  const months = Array.from({ length: 21 }, (_, i) => {
    const year = 2025 + Math.floor(i / 12);
    return `${year}-${String((i % 12) + 1).padStart(2, "0")}-15`;
  });
  const data: BacktestData = {
    sales: months.map((d) => sale(d, 10)),
    leads: [],
    inventory: [],
    factoryOrders: [],
  };

  it("evalúa la ventana de cobertura del corte y marca como parcial la que excede los datos", () => {
    // corte mar-2026: ventana ago-oct 2026, pero los datos terminan en sep-2026
    const [row] = runBacktest({ config, models, data, economicsByModel: new Map(), dataEndMonth: "2026-09" });
    expect(row.months).toEqual(["2026-08", "2026-09"]);
    expect(row.partial).toBe(true);
    expect(row.actualSales).toBe(20);
    expect(row.forecast).toBeCloseTo(20, 5); // demanda constante -> pronóstico exacto
    expect(row.naive).toBeCloseTo(20, 5);
  });

  it("la demanda corregida real suma los leads perdidos por stock de la ventana", () => {
    // 2 leads perdidos por falta de stock en agosto; la tasa de cierre del modelo es 0 (no hay ganadas)
    const withLost: BacktestData = { ...data, leads: [lead("2026-08-10"), lead("2026-08-12")] };
    const [row] = runBacktest({ config, models, data: withLost, economicsByModel: new Map(), dataEndMonth: "2026-09" });
    expect(row.actualCorrected).toBe(20); // sin ganadas la tasa de cierre es 0: no suma nada extra
    const won = { ...lead("2026-08-14"), result: "Ganada", lossReasonCategory: null };
    const withWon: BacktestData = { ...data, leads: [lead("2026-08-10"), lead("2026-08-12"), won] };
    const [rowWon] = runBacktest({ config, models, data: withWon, economicsByModel: new Map(), dataEndMonth: "2026-09" });
    expect(rowWon.actualCorrected).toBeGreaterThan(20); // 2 perdidas x (1/3 de cierre)
  });

  it("no usa ventas posteriores al corte para pronosticar", () => {
    const withBoom: BacktestData = { ...data, sales: [...data.sales, sale("2026-08-20", 500)] };
    const [row] = runBacktest({ config, models, data: withBoom, economicsByModel: new Map(), dataEndMonth: "2026-09" });
    expect(row.forecast).toBeCloseTo(20, 5); // el pico de agosto es futuro al corte de marzo
    expect(row.actualSales).toBe(520);
  });
});
