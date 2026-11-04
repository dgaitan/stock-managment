import { describe, expect, it } from "vitest";
import { computeCloseRate, computeMonthlyCorrectedDemand, deriveDemandMonths } from "@/lib/engine/demand";
import type { NormalizedLead, NormalizedSale } from "@/lib/sources/types";

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
    modelNameRaw: "Corolla Cross",
    modelName: "Corolla Cross",
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

function lead(partial: Partial<NormalizedLead>): NormalizedLead {
  return {
    externalId: Math.random().toString(),
    createdAt: "2026-01-01",
    closedAt: "2026-01-10",
    branchNameRaw: null,
    branchName: null,
    seller: null,
    customerType: "Individual",
    modelNameRaw: "Corolla Cross",
    modelName: "Corolla Cross",
    version: null,
    units: 1,
    result: "Perdida",
    lossReasonRaw: "Sin stock",
    lossReasonCategory: "stock",
    boughtModelNameRaw: null,
    boughtModelName: null,
    boughtVersion: null,
    ...partial,
  };
}

describe("computeCloseRate", () => {
  it("calcula ganadas / total para los leads del modelo", () => {
    const leads = [
      lead({ result: "Ganada", lossReasonCategory: null }),
      lead({ result: "Ganada", lossReasonCategory: null }),
      lead({ result: "Perdida" }),
      lead({ result: "Perdida", modelName: "Rush" }), // de otro modelo, no cuenta
    ];
    expect(computeCloseRate("Corolla Cross", leads)).toBeCloseTo(2 / 3);
  });

  it("devuelve 0 si el modelo no tiene leads", () => {
    expect(computeCloseRate("Hiace", [])).toBe(0);
  });
});

describe("computeMonthlyCorrectedDemand", () => {
  it("excluye ventas de flota de la demanda base", () => {
    const sales = [
      sale({ date: "2026-03-05", units: 5 }),
      sale({ date: "2026-03-10", units: 50, customerType: "Flota / Institucional", isFleetOutlier: true }),
    ];
    const result = computeMonthlyCorrectedDemand("Corolla Cross", sales, [], ["2026-03"]);
    expect(result[0].baseSales).toBe(5);
    expect(result[0].correctedDemand).toBe(5);
  });

  it("recupera demanda oculta de leads perdidos por stock, ponderada por la tasa de cierre", () => {
    const sales = [sale({ date: "2026-03-05", units: 2 })];
    const leads = [
      lead({ result: "Ganada", lossReasonCategory: null, closedAt: "2026-03-01" }),
      lead({ result: "Perdida", lossReasonCategory: "stock", closedAt: "2026-03-10", units: 4 }),
    ];
    // tasa de cierre = 1 ganada / 2 total = 0.5
    const result = computeMonthlyCorrectedDemand("Corolla Cross", sales, leads, ["2026-03"]);
    expect(result[0].lostStockRecovered).toBe(2); // 4 unidades perdidas x 0.5
    expect(result[0].correctedDemand).toBe(4); // 2 base + 2 recuperadas
  });

  it("resta del modelo comprado las ventas que fueron sustitución de otro modelo", () => {
    const sales = [sale({ date: "2026-03-05", units: 10, modelName: "RAV4", modelNameRaw: "RAV4" })];
    const leads = [
      lead({
        modelName: "Corolla Cross",
        boughtModelName: "RAV4",
        result: "Ganada",
        lossReasonCategory: null,
        closedAt: "2026-03-08",
        units: 3,
      }),
    ];
    const result = computeMonthlyCorrectedDemand("RAV4", sales, leads, ["2026-03"]);
    expect(result[0].substitutionRemoved).toBe(3);
    expect(result[0].correctedDemand).toBe(7); // 10 ventas - 3 sustitución
  });

  it("suma al modelo de interés la demanda que se fue a otro modelo (sustitución)", () => {
    const leads = [
      lead({
        modelName: "Corolla Cross",
        boughtModelName: "RAV4",
        result: "Ganada",
        lossReasonCategory: null,
        closedAt: "2026-03-08",
        units: 3,
      }),
    ];
    const result = computeMonthlyCorrectedDemand("Corolla Cross", [], leads, ["2026-03"]);
    expect(result[0].substitutionRecovered).toBe(3);
    expect(result[0].correctedDemand).toBe(3);
  });

  it("la sustitución conserva la demanda total: lo que se suma a un modelo se resta al otro", () => {
    const sales = [sale({ date: "2026-03-05", units: 10, modelName: "RAV4", modelNameRaw: "RAV4" })];
    const leads = [
      lead({
        modelName: "Corolla Cross",
        boughtModelName: "RAV4",
        result: "Ganada",
        lossReasonCategory: null,
        closedAt: "2026-03-08",
        units: 3,
      }),
    ];
    const cc = computeMonthlyCorrectedDemand("Corolla Cross", [], leads, ["2026-03"])[0];
    const rav = computeMonthlyCorrectedDemand("RAV4", sales, leads, ["2026-03"])[0];
    expect(cc.correctedDemand + rav.correctedDemand).toBe(10);
  });

  it("deriveDemandMonths une los meses de ventas y leads del modelo", () => {
    const sales = [sale({ date: "2026-01-05" })];
    const leads = [lead({ closedAt: "2026-02-10" })];
    expect(deriveDemandMonths("Corolla Cross", sales, leads)).toEqual(["2026-01", "2026-02"]);
  });
});
