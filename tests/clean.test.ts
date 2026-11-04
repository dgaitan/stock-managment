import { describe, expect, it } from "vitest";
import {
  collapseSpaces,
  computeLineHash,
  excelSerialToISODate,
  isCreditNote,
  isFleetOutlier,
  normalizeLossReason,
  normalizeModelName,
} from "@/lib/engine/clean";

const CANONICAL_MODELS = [
  "Hilux",
  "Fortuner",
  "Corolla",
  "Corolla Cross",
  "Yaris",
  "Yaris Cross",
  "RAV4",
  "Land Cruiser Prado",
  "Rush",
  "Hiace",
  "Raize",
];

describe("normalizeModelName", () => {
  it("normaliza variantes de mayúsculas, espacios y prefijo Toyota", () => {
    const cases: Array<[string, string]> = [
      ["HILUX", "Hilux"],
      ["Toyota Hilux", "Hilux"],
      ["Hilux ", "Hilux"],
      ["Corolla  Cross", "Corolla Cross"],
      ["corolla cross", "Corolla Cross"],
      [" Land  Cruiser  Prado", "Land Cruiser Prado"],
      ["Toyota RAV4", "RAV4"],
      ["rav4", "RAV4"],
    ];
    for (const [raw, expected] of cases) {
      expect(normalizeModelName(raw, CANONICAL_MODELS)).toBe(expected);
    }
  });

  it("devuelve null para un modelo que no está en el catálogo", () => {
    expect(normalizeModelName("Toyota Supra", CANONICAL_MODELS)).toBeNull();
    expect(normalizeModelName(null, CANONICAL_MODELS)).toBeNull();
    expect(normalizeModelName("", CANONICAL_MODELS)).toBeNull();
  });
});

describe("normalizeLossReason", () => {
  it("mapea las 8 variantes de falta de stock a la categoría stock", () => {
    const variantes = [
      "Sin disponibilidad",
      "Sin inventario",
      "Sin stock",
      "Sin disponibilidad / sin inventario",
      "Sin disponibilidad de versión/color",
      "No hay unidades disponibles",
      "Color no disponible",
      "Versión no disponible",
    ];
    for (const raw of variantes) {
      expect(normalizeLossReason(raw)).toBe("stock");
    }
  });

  it("mapea el resto de motivos a su categoría", () => {
    expect(normalizeLossReason("Precio")).toBe("price");
    expect(normalizeLossReason("Financiamiento rechazado")).toBe("financing");
    expect(normalizeLossReason("Compró a la competencia")).toBe("competitor");
    expect(normalizeLossReason("Pospone la compra")).toBe("postponed");
    expect(normalizeLossReason("No responde / sin seguimiento")).toBe("no_followup");
  });

  it("devuelve null para un motivo desconocido", () => {
    expect(normalizeLossReason("Motivo inventado")).toBeNull();
    expect(normalizeLossReason(null)).toBeNull();
  });
});

describe("isCreditNote", () => {
  it("detecta facturas NC- sin distinguir mayúsculas", () => {
    expect(isCreditNote("NC-880383")).toBe(true);
    expect(isCreditNote("nc-123")).toBe(true);
    expect(isCreditNote("FAC-880066")).toBe(false);
    expect(isCreditNote(null)).toBe(false);
  });
});

describe("isFleetOutlier", () => {
  it("marca como atípica la flota con 10 o más unidades", () => {
    expect(isFleetOutlier("Flota / Institucional", 60, 10)).toBe(true);
    expect(isFleetOutlier("Flota / Institucional", 10, 10)).toBe(true);
    expect(isFleetOutlier("Flota / Institucional", 9, 10)).toBe(false);
    expect(isFleetOutlier("Empresa", 60, 10)).toBe(false);
  });
});

describe("computeLineHash", () => {
  it("es estable para las mismas partes y distinto para partes distintas", () => {
    const a = computeLineHash(["FAC-1", "Hilux", 1, 42840]);
    const b = computeLineHash(["FAC-1", "Hilux", 1, 42840]);
    const c = computeLineHash(["FAC-2", "Hilux", 1, 42840]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("trata null/undefined como cadena vacía de forma consistente", () => {
    expect(computeLineHash(["x", null])).toBe(computeLineHash(["x", undefined]));
  });
});

describe("excelSerialToISODate", () => {
  it("convierte seriales conocidos de Excel a ISO", () => {
    expect(excelSerialToISODate(45200)).toBe("2023-10-01");
    expect(excelSerialToISODate(45566)).toBe("2024-10-01");
  });
});

describe("collapseSpaces", () => {
  it("recorta y colapsa espacios internos", () => {
    expect(collapseSpaces("  Corolla   Cross  ")).toBe("Corolla Cross");
  });
});
