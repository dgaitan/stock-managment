import { describe, expect, it } from "vitest";
import { alertsForModel, parseNarrative } from "@/lib/orders/narrativeText";

const TEXT = "Resumen del pedido.\n- Corolla Cross cubre 8 meses\n- Yaris pide el mínimo\n- yaris cross sin stock";

describe("parseNarrative", () => {
  it("separa análisis y alertas", () => {
    expect(parseNarrative(TEXT)).toEqual({
      analysis: "Resumen del pedido.",
      alerts: ["Corolla Cross cubre 8 meses", "Yaris pide el mínimo", "yaris cross sin stock"],
    });
  });
});

describe("alertsForModel", () => {
  const MODELS = ["Yaris", "Yaris Cross", "Corolla", "Corolla Cross", "Hilux"];

  it("devuelve las alertas que nombran al modelo, sin mezclar un nombre con otro más largo que lo contiene", () => {
    expect(alertsForModel(TEXT, "Yaris", MODELS)).toEqual(["Yaris pide el mínimo"]);
    expect(alertsForModel(TEXT, "Yaris Cross", MODELS)).toEqual(["yaris cross sin stock"]);
    expect(alertsForModel(TEXT, "Corolla", MODELS)).toEqual([]);
    expect(alertsForModel(TEXT, "Hilux", MODELS)).toEqual([]);
    expect(alertsForModel(null, "Hilux", MODELS)).toEqual([]);
  });

  it("una alerta que nombra ambos modelos cuenta para los dos", () => {
    expect(alertsForModel("x\n- Yaris y Yaris Cross piden el mínimo", "Yaris", MODELS)).toHaveLength(1);
  });
});
