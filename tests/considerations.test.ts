import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { proposalSchema, validateProposal, type ConsiderationProposal } from "@/lib/ai/considerations";
import { translateConsiderations } from "@/lib/ai/rules";

const CTX = { models: ["Hilux", "Rush", "Corolla Cross"], months: ["2026-12", "2027-02", "2027-03"] };
const empty: ConsiderationProposal = { demandFactors: [], excludedModels: [], notApplied: [] };

describe("proposalSchema", () => {
  it("solo expone factores, exclusiones y no aplicadas: la IA no puede proponer cantidades", () => {
    expect(Object.keys(proposalSchema.shape).sort()).toEqual(["demandFactors", "excludedModels", "notApplied"]);
  });
});

describe("validateProposal", () => {
  it("acepta un factor válido, normaliza el nombre del modelo y lo lista como aplicado", () => {
    const result = validateProposal(
      { ...empty, demandFactors: [{ model: "hilux ", factor: 1.2, months: ["2027-02", "2027-03"] }] },
      CTX,
    );
    expect(result.adjustments.demandFactors).toEqual([{ model: "Hilux", factor: 1.2, months: ["2027-02", "2027-03"] }]);
    expect(result.applied).toEqual(["Hilux: demanda ×1.2 en 2027-02, 2027-03"]);
    expect(result.notApplied).toEqual([]);
  });

  it("months null o vacío significa todos los meses", () => {
    const result = validateProposal({ ...empty, demandFactors: [{ model: "Rush", factor: 0.8, months: null }] }, CTX);
    expect(result.adjustments.demandFactors[0].months).toBeUndefined();
  });

  it("rechaza modelo desconocido, factor fuera de rango y meses fuera del horizonte", () => {
    const result = validateProposal(
      {
        ...empty,
        demandFactors: [
          { model: "Camry", factor: 1.2, months: null },
          { model: "Hilux", factor: 5, months: null },
          { model: "Hilux", factor: 0, months: null },
          { model: "Rush", factor: 1.1, months: ["2030-01"] },
        ],
      },
      CTX,
    );
    expect(result.adjustments.demandFactors).toEqual([]);
    expect(result.notApplied).toHaveLength(4);
    expect(result.notApplied[0].reason).toContain("no es un modelo");
    expect(result.notApplied[1].reason).toContain("entre");
    expect(result.notApplied[3].reason).toContain("2030-01");
  });

  it("excluye modelos válidos sin duplicar y rechaza los desconocidos", () => {
    const result = validateProposal({ ...empty, excludedModels: ["Rush", "rush", "Camry"] }, CTX);
    expect(result.adjustments.excludedModels).toEqual(["Rush"]);
    expect(result.notApplied).toHaveLength(1);
  });

  it("conserva lo que el modelo ya marcó como no aplicado", () => {
    const result = validateProposal(
      { ...empty, notApplied: [{ text: "Tope de capital de 5 M", reason: "el motor no tiene tope de capital" }] },
      CTX,
    );
    expect(result.notApplied).toEqual([{ text: "Tope de capital de 5 M", reason: "el motor no tiene tope de capital" }]);
  });
});

describe("translateConsiderations", () => {
  const proposal: ConsiderationProposal = {
    ...empty,
    excludedModels: ["Rush"],
    demandFactors: [{ model: "Hilux", factor: 9, months: null }],
  };

  it("pasa la respuesta del modelo por la validación y manda el contexto al prompt", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: proposal });
    const result = await translateConsiderations({
      client: { parse } as never,
      model: "test-model",
      text: "Excluir Rush y Hilux al 900 %",
      context: CTX,
    });
    expect(result.adjustments.excludedModels).toEqual(["Rush"]);
    expect(result.notApplied).toHaveLength(1);
    const args = parse.mock.calls[0][0];
    expect(args.model).toBe("test-model");
    expect(args.system).toContain("Corolla Cross");
    expect(args.system).toContain("2027-02");
    expect(args.messages).toEqual([{ role: "user", content: "Excluir Rush y Hilux al 900 %" }]);
  });

  it("lanza si el modelo no devuelve una salida interpretable", async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: null });
    await expect(
      translateConsiderations({ client: { parse } as never, model: "m", text: "x", context: CTX }),
    ).rejects.toThrow(/interpretación/);
  });
});
