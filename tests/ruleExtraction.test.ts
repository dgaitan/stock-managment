import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractBulletinRules } from "@/lib/ai/bulletinRules";
import { extractionSchema, validateExtraction, type RuleExtraction } from "@/lib/ai/ruleExtraction";

const CTX = { models: ["Hilux", "RAV4"], cycle: "permanent" };
const empty: RuleExtraction = { rules: [], notExtracted: [] };

describe("extractionSchema", () => {
  it("solo expone reglas y lo no extraído: la IA no calcula pedidos", () => {
    expect(Object.keys(extractionSchema.shape).sort()).toEqual(["notExtracted", "rules"]);
  });
});

describe("validateExtraction", () => {
  it("acepta reglas válidas y normaliza el nombre del modelo", () => {
    const result = validateExtraction(
      { ...empty, rules: [{ model: "hilux", key: "lot_min", value: " 12 " }, { model: "RAV4", key: "lifecycle", value: "last_window" }] },
      CTX,
    );
    expect(result.rules).toEqual([
      { model: "Hilux", key: "lot_min", value: "12" },
      { model: "RAV4", key: "lifecycle", value: "last_window" },
    ]);
    expect(result.notExtracted).toEqual([]);
  });

  it("rechaza modelo desconocido, clave que el motor no entiende y valores inválidos", () => {
    const result = validateExtraction(
      {
        ...empty,
        rules: [
          { model: "Camry", key: "lot_min", value: "4" },
          { model: "Hilux", key: "discount_pct", value: "5" },
          { model: "Hilux", key: "lot_multiple", value: "0" },
          { model: "Hilux", key: "lifecycle", value: "eol" },
          { model: "Hilux", key: "lot_min", value: "abc" },
        ],
      },
      CTX,
    );
    expect(result.rules).toEqual([]);
    expect(result.notExtracted).toHaveLength(5);
    expect(result.notExtracted[1].reason).toContain("discount_pct");
  });

  it("descarta la regla repetida del mismo modelo y clave", () => {
    const result = validateExtraction(
      { ...empty, rules: [{ model: "Hilux", key: "lot_min", value: "12" }, { model: "Hilux", key: "lot_min", value: "18" }] },
      CTX,
    );
    expect(result.rules).toEqual([{ model: "Hilux", key: "lot_min", value: "12" }]);
    expect(result.notExtracted).toHaveLength(1);
  });

  it("conserva lo que el modelo ya marcó como no extraído", () => {
    const result = validateExtraction(
      { ...empty, notExtracted: [{ text: "Descuento 4 % a 180 días", reason: "el motor no lo usa" }] },
      CTX,
    );
    expect(result.notExtracted).toHaveLength(1);
  });
});

describe("extractBulletinRules", () => {
  it("manda el comunicado y los modelos al prompt y valida la respuesta", async () => {
    const parse = vi.fn().mockResolvedValue({
      parsed_output: { ...empty, rules: [{ model: "Hilux", key: "lot_min", value: "12" }, { model: "Camry", key: "lot_min", value: "1" }] },
    });
    const result = await extractBulletinRules({
      client: { parse } as never,
      model: "m",
      bulletin: { date: "2025-06-03", subject: "Lotes", body: "Hilux 12/6" },
      models: CTX.models,
      cycle: "permanent",
    });
    expect(result.rules).toHaveLength(1);
    expect(result.notExtracted).toHaveLength(1);
    const args = parse.mock.calls[0][0];
    expect(args.system).toContain("Hilux, RAV4");
    expect(args.messages[0].content).toContain("Asunto: Lotes");
  });

  it("lanza si no hay salida interpretable", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: null });
    await expect(
      extractBulletinRules({ client: { parse } as never, model: "m", bulletin: { date: "d", subject: "s", body: "b" }, models: [], cycle: "permanent" }),
    ).rejects.toThrow(/extracción/);
  });
});
