import { describe, expect, it } from "vitest";
import {
  classifySafetyTier,
  computeModelOrderPlan,
  computeOrderUnits,
  computePatioAndTransito,
  roundToLot,
} from "@/lib/engine/order";
import type { CycleConfig, ModelConfig } from "@/lib/engine/config";
import { deriveCycle } from "@/lib/engine/cycle";
import type { NormalizedFactoryOrder, NormalizedInventorySnapshot, NormalizedSale } from "@/lib/sources/types";

const HILUX: ModelConfig = { name: "Hilux", lot_min: 12, lot_multiple: 6 };
const RAV4: ModelConfig = {
  name: "RAV4",
  lot_min: 4,
  lot_multiple: 4,
  lifecycle: "last_window",
  horizon_months: 3,
  safety_stock_override: 0,
};

const CYCLE = deriveCycle({ cutoffDate: "2026-09-30", leadTimeMonths: 4, windowMonths: [1, 4, 7, 10] });

const BASE_CONFIG: CycleConfig = {
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
  aging_discounts: { "180": 0.04, "270": 0.07, "365": 0.1 },
  loss_reason_categories: ["stock", "price", "financing", "competitor", "postponed", "no_followup"],
  backtest_cutoffs: [],
};

describe("roundToLot", () => {
  it("sube al multiplo mas cercano", () => {
    expect(roundToLot(7, 6)).toBe(12);
    expect(roundToLot(12, 6)).toBe(12);
    expect(roundToLot(13, 6)).toBe(18);
  });

  it("devuelve 0 si las unidades no son positivas", () => {
    expect(roundToLot(0, 6)).toBe(0);
    expect(roundToLot(-5, 6)).toBe(0);
  });
});

describe("computeOrderUnits", () => {
  it("el pedido es 0 si la necesidad es <= 0", () => {
    expect(computeOrderUnits(0, HILUX, 0.5)).toBe(0);
    expect(computeOrderUnits(-10, HILUX, 0.5)).toBe(0);
  });

  it("el pedido es 0 si la necesidad queda bajo el minimo efectivo (50% del minimo)", () => {
    expect(computeOrderUnits(5, HILUX, 0.5)).toBe(0); // 5 < 12*0.5=6
  });

  it("sube al minimo y redondea al multiplo si la necesidad supera el umbral efectivo", () => {
    expect(computeOrderUnits(7, HILUX, 0.5)).toBe(12); // 7 >= 6, sube al minimo 12
    expect(computeOrderUnits(20, HILUX, 0.5)).toBe(24); // 20 -> multiplo de 6 hacia arriba
  });

  it("todo pedido != 0 cumple minimo Y multiplo de lote", () => {
    for (let need = -5; need <= 40; need += 1) {
      const order = computeOrderUnits(need, HILUX, 0.5);
      if (order !== 0) {
        expect(order).toBeGreaterThanOrEqual(HILUX.lot_min);
        expect(order % HILUX.lot_multiple).toBe(0);
      }
    }
  });
});

describe("classifySafetyTier", () => {
  const cfg = BASE_CONFIG.safety_stock;
  it("margen alto y costo financiero normal -> colchon alto", () => {
    expect(classifySafetyTier({ unitCost: 1000, marginPct: 0.13, monthlyFinCost: 300 }, cfg)).toBe("high");
  });
  it("margen bajo -> colchon bajo", () => {
    expect(classifySafetyTier({ unitCost: 1000, marginPct: 0.07, monthlyFinCost: 100 }, cfg)).toBe("low");
  });
  it("costo financiero alto penaliza aunque el margen sea alto", () => {
    expect(classifySafetyTier({ unitCost: 1000, marginPct: 0.2, monthlyFinCost: 500 }, cfg)).toBe("low");
  });
  it("margen intermedio -> colchon medio", () => {
    expect(classifySafetyTier({ unitCost: 1000, marginPct: 0.1, monthlyFinCost: 100 }, cfg)).toBe("mid");
  });
});

describe("computePatioAndTransito", () => {
  it("suma el inventario del mes de corte y los pedidos aun no recibidos ordenados antes del corte", () => {
    const inventory: NormalizedInventorySnapshot[] = [
      {
        monthEnd: "2026-09-30",
        modelNameRaw: "Hilux",
        modelName: "Hilux",
        version: null,
        color: null,
        units: 135,
        avgAgeDays: null,
      },
    ];
    const factoryOrders: NormalizedFactoryOrder[] = [
      {
        orderNo: "PF-1",
        businessKey: "bk",
        lineHash: "h1",
        orderDate: "2026-06-01",
        modelNameRaw: "Hilux",
        modelName: "Hilux",
        version: null,
        color: null,
        units: 103,
        eta: "2026-11-01",
        status: "En tránsito",
        receivedAt: null,
      },
      {
        orderNo: "PF-2",
        businessKey: "bk",
        lineHash: "h2",
        orderDate: "2026-08-01",
        modelNameRaw: "Hilux",
        modelName: "Hilux",
        version: null,
        color: null,
        units: 50,
        eta: "2026-09-10",
        status: "Recibido",
        receivedAt: "2026-09-10",
      },
    ];
    const result = computePatioAndTransito({
      modelName: "Hilux",
      inventory,
      factoryOrders,
      cutoffDate: "2026-09-30",
    });
    expect(result.patio).toBe(135);
    expect(result.transito).toBe(103); // el PF-2 ya se recibio antes del corte, no cuenta
  });
});

describe("computeModelOrderPlan", () => {
  function sale(partial: Partial<NormalizedSale>): NormalizedSale {
    return {
      invoice: "FAC",
      businessKey: "bk",
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
      units: 10,
      unitPrice: null,
      note: null,
      isCreditNote: false,
      isFleetOutlier: false,
      ...partial,
    };
  }

  const economics = { unitCost: 38000, marginPct: 0.13, monthlyFinCost: 340 };

  it("el pedido final siempre es 0 o cumple minimo y multiplo de lote", () => {
    const sales = [
      sale({ date: "2025-06-15", units: 12 }),
      sale({ date: "2025-12-15", units: 12 }),
      sale({ date: "2026-06-15", units: 12 }),
      // venta de flota grande, excluida de la demanda base
      sale({ date: "2026-08-15", units: 60, customerType: "Flota / Institucional", isFleetOutlier: true }),
    ];
    const plan = computeModelOrderPlan({
      config: BASE_CONFIG,
      cycle: CYCLE,
      model: HILUX,
      economics,
      sales,
      leads: [],
      inventory: [],
      factoryOrders: [],
    });
    if (plan.orderUnits !== 0) {
      expect(plan.orderUnits).toBeGreaterThanOrEqual(HILUX.lot_min);
      expect(plan.orderUnits % HILUX.lot_multiple).toBe(0);
    }
    // la venta de flota (60 u) no debe inflar la tasa de demanda pronosticada
    expect(plan.forecastMonthlyRate).toBeLessThan(60);
  });

  it("el stock proyectado al mes de llegada no es negativo y la demanda sin stock no infla el pedido", () => {
    // demanda ~20 u/mes constante, sin patio ni transito: oct-ene se pierde entera
    const sales = ["01", "02", "03", "04", "05", "06", "07", "08", "09"].map((mm) =>
      sale({ date: `2026-${mm}-15`, units: 20 }),
    );
    const plan = computeModelOrderPlan({
      config: BASE_CONFIG,
      cycle: CYCLE,
      model: HILUX,
      economics,
      sales,
      leads: [],
      inventory: [],
      factoryOrders: [],
    });
    expect(plan.projectedStockAtArrival).toBe(0);
    expect(plan.unmetDemandGap).toBeGreaterThan(0);
    // necesidad = demanda de cobertura + colchon, sin sumar la demanda perdida hasta la llegada
    expect(plan.need).toBeCloseTo(plan.demandCoverageWindow + plan.safetyStockUnits, 6);
  });

  it("imputa los meses de quiebre y los reporta en el plan y en las alertas", () => {
    // vendia 20 u/mes con patio, luego quedo sin snapshot (stock 0) de junio a septiembre
    const sales = ["01", "02", "03", "04", "05"].map((mm) => sale({ date: `2026-${mm}-15`, units: 20 }));
    sales.push(sale({ date: "2026-06-15", units: 2 }), sale({ date: "2026-09-15", units: 1 }));
    const inventory = ["01", "02", "03", "04", "05"].map((mm) => ({
      monthEnd: `2026-${mm}-28`,
      modelNameRaw: "Hilux",
      modelName: "Hilux",
      version: null,
      color: null,
      units: 40,
      avgAgeDays: null,
    }));
    const plan = computeModelOrderPlan({
      config: BASE_CONFIG,
      cycle: CYCLE,
      model: HILUX,
      economics,
      sales,
      leads: [],
      inventory,
      factoryOrders: [],
    });
    expect(plan.imputedStockoutMonths).toBeGreaterThan(0);
    expect(plan.flags).toContain("demanda_imputada_por_quiebre");
  });

  it("RAV4 (ultima ventana) usa colchon de seguridad 0 por su safety_stock_override", () => {
    const sales = [sale({ date: "2026-06-15", units: 4, modelName: "RAV4", modelNameRaw: "RAV4" })];
    const plan = computeModelOrderPlan({
      config: BASE_CONFIG,
      cycle: CYCLE,
      model: RAV4,
      economics: { unitCost: 38000, marginPct: 0.1, monthlyFinCost: 350 },
      sales,
      leads: [],
      inventory: [],
      factoryOrders: [],
    });
    expect(plan.safetyStockUnits).toBe(0);
    expect(plan.flags).toContain("ultima_ventana_de_generacion");
  });
});
