import { describe, expect, it } from "vitest";
import { modelCatalogWrite } from "@/lib/db/seedCatalog";
import type { NormalizedModelEconomics } from "@/lib/sources/types";

const HILUX: NormalizedModelEconomics = {
  modelNameRaw: "Hilux",
  modelName: "Hilux",
  avgPrice: 41000,
  marginPct: 0.12,
  avgUnitCost: 38020,
  monthlyFinCostPerUnit: 342,
  agingDiscountPolicyRaw: null,
};

describe("modelCatalogWrite", () => {
  it("con la economía del archivo, inserta y actualiza el costo, el margen y el costo financiero", () => {
    const { values, update } = modelCatalogWrite("Hilux", HILUX);
    expect(values).toEqual({ name: "Hilux", unitCost: "38020", marginPct: "0.12", monthlyFinCost: "342" });
    expect(update).toEqual({ unitCost: "38020", marginPct: "0.12", monthlyFinCost: "342" });
  });

  it("sin la hoja de economía, un modelo nuevo entra en 0 y uno existente no se toca", () => {
    const { values, update } = modelCatalogWrite("Hilux", undefined);
    expect(values).toEqual({ name: "Hilux", unitCost: "0", marginPct: "0", monthlyFinCost: "0" });
    expect(update).toBeNull();
  });
});
