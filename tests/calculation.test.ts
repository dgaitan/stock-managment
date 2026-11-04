import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { formatNarrative, writeNarrative, type NarrativeFacts } from "@/lib/ai/narrative";
import { calculationRequestSchema } from "@/lib/orders/request";

describe("calculationRequestSchema", () => {
  const valid = {
    excludedRuleIds: [3],
    considerations: { text: "Promoción de Rush", demandFactors: [{ model: "Rush", factor: 1.3, months: null }], excludedModels: [] },
    saveAsBulletin: false,
  };

  it("acepta una solicitud con y sin consideraciones", () => {
    expect(calculationRequestSchema.safeParse(valid).success).toBe(true);
    expect(calculationRequestSchema.safeParse({ ...valid, considerations: null }).success).toBe(true);
  });

  it("rechaza ids de regla inválidos, texto vacío y campos faltantes", () => {
    expect(calculationRequestSchema.safeParse({ ...valid, excludedRuleIds: [0] }).success).toBe(false);
    expect(
      calculationRequestSchema.safeParse({ ...valid, considerations: { ...valid.considerations, text: "  " } }).success,
    ).toBe(false);
    expect(calculationRequestSchema.safeParse({ excludedRuleIds: [] }).success).toBe(false);
  });
});

describe("narrativa", () => {
  const facts: NarrativeFacts = {
    window: "2026-10",
    totalUnits: 10,
    totalCapital: 1000,
    considerations: [],
    lines: [{ model: "Hilux", orderUnits: 10, capital: 1000, orderCoverageMonths: 2, projectedStockAtArrival: 5, flags: [] }],
  };

  it("formatNarrative pone el análisis y una alerta por línea con guion", () => {
    expect(formatNarrative({ analysis: " Total 10 u. ", alerts: ["Cobertura alta", " Rush ajustado "] })).toBe(
      "Total 10 u.\n- Cobertura alta\n- Rush ajustado",
    );
    expect(formatNarrative({ analysis: "Solo análisis", alerts: [] })).toBe("Solo análisis");
  });

  it("writeNarrative manda solo las cifras del motor y devuelve el texto formateado", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: { analysis: "Resumen", alerts: ["Alerta"] } });
    const text = await writeNarrative({ client: { parse } as never, model: "m", facts });
    expect(text).toBe("Resumen\n- Alerta");
    const args = parse.mock.calls[0][0];
    expect(JSON.parse(args.messages[0].content)).toEqual(facts);
    expect(args.system).toContain("No inventes cifras");
  });

  it("lanza si el modelo no devuelve un análisis válido", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: null });
    await expect(writeNarrative({ client: { parse } as never, model: "m", facts })).rejects.toThrow(/análisis/);
  });
});
