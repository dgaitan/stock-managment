import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { formatNarrative } from "@/lib/ai/narrative";

describe("contrato del texto de la narrativa", () => {
  it("lo que guarda formatNarrative separa análisis y alertas por el prefijo «- »", () => {
    const text = formatNarrative({ analysis: "Resumen del pedido.", alerts: ["Cobertura alta en un modelo"] });
    const lines = text.split("\n");
    expect(lines[0]).toBe("Resumen del pedido.");
    expect(lines.slice(1).every((l) => l.startsWith("- "))).toBe(true);
  });
});
