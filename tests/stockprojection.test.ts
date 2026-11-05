import { describe, expect, it } from "vitest";
import { groupTransitArrivals, isInTransitAtCutoff, projectStock } from "@/lib/engine/stockprojection";
import type { NormalizedFactoryOrder } from "@/lib/sources/types";

const MONTHS = ["2026-10", "2026-11", "2026-12", "2027-01"];

function order(partial: Partial<NormalizedFactoryOrder>): NormalizedFactoryOrder {
  return {
    orderNo: "PF-1",
    businessKey: "bk",
    lineHash: "h",
    orderDate: "2026-07-27",
    modelNameRaw: "Corolla Cross",
    modelName: "Corolla Cross",
    version: null,
    color: null,
    units: 1,
    eta: "2026-11-05",
    status: "En tránsito",
    receivedAt: null,
    ...partial,
  };
}

describe("projectStock", () => {
  it("el stock nunca baja de 0: la demanda sin stock se pierde y no se arrastra", () => {
    const result = projectStock({
      startingStock: 0,
      months: MONTHS,
      arrivalsByMonth: { "2026-10": 0, "2026-11": 30, "2026-12": 0, "2027-01": 0 },
      arrivalsAfterPeriod: 0,
      forecastByMonth: { "2026-10": 24, "2026-11": 24, "2026-12": 24, "2027-01": 24 },
    });
    // oct: 24 perdidas; nov: entran 30, vende 24, quedan 6; dic: vende 6, pierde 18; ene: pierde 24
    expect(result.stockEnd).toBe(0);
    expect(result.unmetDemand).toBe(66);
  });

  it("sin faltantes coincide con patio + transito - demanda", () => {
    const result = projectStock({
      startingStock: 100,
      months: MONTHS,
      arrivalsByMonth: { "2026-10": 20, "2026-11": 0, "2026-12": 0, "2027-01": 0 },
      arrivalsAfterPeriod: 0,
      forecastByMonth: { "2026-10": 10, "2026-11": 10, "2026-12": 10, "2027-01": 10 },
    });
    expect(result.stockEnd).toBe(80);
    expect(result.unmetDemand).toBe(0);
  });

  it("el transito con ETA posterior al periodo no se vende antes pero cuenta al cierre", () => {
    const result = projectStock({
      startingStock: 0,
      months: MONTHS,
      arrivalsByMonth: { "2026-10": 0, "2026-11": 0, "2026-12": 0, "2027-01": 0 },
      arrivalsAfterPeriod: 12,
      forecastByMonth: { "2026-10": 5, "2026-11": 5, "2026-12": 5, "2027-01": 5 },
    });
    expect(result.stockEnd).toBe(12);
    expect(result.unmetDemand).toBe(20);
  });
});

describe("groupTransitArrivals", () => {
  it("agrupa por mes de ETA las lineas aun no recibidas al corte", () => {
    const result = groupTransitArrivals({
      modelName: "Corolla Cross",
      cutoffDate: "2026-09-30",
      months: MONTHS,
      factoryOrders: [
        order({ units: 2, eta: "2026-11-03" }),
        order({ units: 3, eta: "2026-11-20" }),
        order({ units: 1, eta: "2026-12-08" }),
        order({ units: 9, eta: "2026-08-01", receivedAt: "2026-08-01", status: "Recibido" }),
        order({ units: 7, modelName: "Rush", modelNameRaw: "Rush", eta: "2026-11-03" }),
        order({ units: 4, orderDate: "2026-10-15", eta: "2026-11-03" }),
      ],
    });
    expect(result.byMonth).toEqual({ "2026-10": 0, "2026-11": 5, "2026-12": 1, "2027-01": 0 });
    expect(result.afterPeriod).toBe(0);
  });

  it("ETA vencida o ausente se asume en el primer mes; ETA posterior al periodo va aparte", () => {
    const result = groupTransitArrivals({
      modelName: "Corolla Cross",
      cutoffDate: "2026-09-30",
      months: MONTHS,
      factoryOrders: [
        order({ units: 2, eta: "2026-09-15" }),
        order({ units: 3, eta: null }),
        order({ units: 5, eta: "2027-02-10" }),
      ],
    });
    expect(result.byMonth["2026-10"]).toBe(5);
    expect(result.afterPeriod).toBe(5);
  });

  it("un pedido cancelado no cuenta como tránsito ni como llegada", () => {
    const factoryOrders = [order({ units: 4, eta: "2026-11-03" }), order({ units: 10, eta: "2026-11-03", status: "Cancelado" })];
    const result = groupTransitArrivals({ modelName: "Corolla Cross", cutoffDate: "2026-09-30", months: MONTHS, factoryOrders });
    expect(result.byMonth["2026-11"]).toBe(4);
    expect(isInTransitAtCutoff(factoryOrders[1], "Corolla Cross", "2026-09-30")).toBe(false);
  });
});
