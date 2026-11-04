import { describe, expect, it } from "vitest";
import {
  classifyBulletins,
  classifyEconomics,
  classifyRows,
  economicsHash,
  isNoop,
  lastByKey,
  type DiffCounts,
  type ImportDiff,
} from "@/lib/import/diff";

const counts = (c: Partial<DiffCounts> = {}): DiffCounts => ({ inserted: 0, updated: 0, unchanged: 5, missing: 0, ...c });
const diff = (d: Partial<ImportDiff> = {}): ImportDiff => ({
  sales: counts(),
  leads: counts(),
  factoryOrders: counts(),
  inventory: counts(),
  economics: counts(),
  bulletins: counts(),
  ...d,
});

describe("classifyRows", () => {
  const existing = new Map([
    ["a", "h1"],
    ["b", "h2"],
    ["c", "h3"],
  ]);

  it("reimportar el mismo contenido no inserta ni actualiza nada", () => {
    const counts = classifyRows(existing, [
      { key: "a", hash: "h1" },
      { key: "b", hash: "h2" },
      { key: "c", hash: "h3" },
    ]);
    expect(counts).toEqual({ inserted: 0, updated: 0, unchanged: 3, missing: 0 });
  });

  it("separa filas nuevas, actualizadas, sin cambios y ausentes", () => {
    const counts = classifyRows(existing, [
      { key: "a", hash: "h1" }, // sin cambios
      { key: "b", hash: "h2-nuevo" }, // p. ej. el lead pasó a «Perdida»
      { key: "d", hash: "h4" }, // fila nueva
    ]);
    expect(counts).toEqual({ inserted: 1, updated: 1, unchanged: 1, missing: 1 });
  });

  it("con la base vacía todo es nuevo", () => {
    const counts = classifyRows(new Map(), [{ key: "a", hash: "h1" }]);
    expect(counts).toEqual({ inserted: 1, updated: 0, unchanged: 0, missing: 0 });
  });
});

describe("lastByKey", () => {
  it("deja una fila por clave y gana la última (corrección posterior)", () => {
    const rows = [
      { key: "a", v: 1 },
      { key: "b", v: 2 },
      { key: "a", v: 3 },
    ];
    expect(lastByKey(rows, (r) => r.key)).toEqual([
      { key: "a", v: 3 },
      { key: "b", v: 2 },
    ]);
  });
});

describe("isNoop", () => {
  it("sin nuevas ni actualizadas en ninguna hoja no escribe nada", () => {
    expect(isNoop(diff())).toBe(true);
  });

  it("en inventario, filas ausentes de un mes del archivo sí son un cambio (se borran)", () => {
    expect(isNoop(diff({ inventory: counts({ missing: 2 }) }))).toBe(false);
  });

  it("en ventas, leads y pedidos, filas ausentes no son un cambio (se conservan)", () => {
    expect(
      isNoop(diff({ sales: counts({ missing: 3 }), leads: counts({ missing: 1 }), factoryOrders: counts({ missing: 4 }) })),
    ).toBe(true);
  });

  it("una fila nueva o actualizada en cualquier hoja es un cambio", () => {
    expect(isNoop(diff({ leads: counts({ updated: 1 }) }))).toBe(false);
    expect(isNoop(diff({ bulletins: counts({ inserted: 1 }) }))).toBe(false);
  });
});

describe("economía por modelo", () => {
  it("el hash redondea como las columnas numeric: lo guardado no aparece como actualizado", () => {
    // Postgres guarda numeric(12,2) / (5,4) / (10,2) y los devuelve como texto.
    const stored = economicsHash("38020.00", "0.1235", "342.00");
    const fromExcel = economicsHash(38020, 0.12345, 342);
    expect(fromExcel).toBe(stored);
  });

  it("un cambio real de costo sí se detecta", () => {
    expect(economicsHash(38020, 0.13, 342)).not.toBe(economicsHash(38500, 0.13, 342));
  });

  it("un modelo del catálogo que el archivo no trae no cuenta como cambio", () => {
    const existing = new Map([
      ["Hilux", "h"],
      ["Rush", "r"],
    ]);
    expect(classifyEconomics(existing, [{ key: "Hilux", hash: "h" }])).toEqual({
      inserted: 0,
      updated: 0,
      unchanged: 1,
      missing: 0,
    });
  });
});

describe("comunicados", () => {
  it("solo se agregan los nuevos; uno existente queda sin cambios aunque el Excel traiga otro texto", () => {
    const existing = new Set(["2024-02-12|Calendario de pedidos"]);
    // La clave es fecha + asunto: el cuerpo no participa, así que un texto editado no la cambia.
    expect(classifyBulletins(existing, ["2024-02-12|Calendario de pedidos", "2026-11-01|Nuevo lanzamiento"])).toEqual({
      inserted: 1,
      updated: 0,
      unchanged: 1,
      missing: 0,
    });
  });

  it("un comunicado guardado que el archivo ya no trae no se borra", () => {
    const existing = new Set(["2024-02-12|Calendario de pedidos", "2026-09-15|RAV4"]);
    expect(classifyBulletins(existing, ["2024-02-12|Calendario de pedidos"]).missing).toBe(0);
  });
});
