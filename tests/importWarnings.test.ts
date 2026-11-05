import { describe, expect, it } from "vitest";
import type { DiffCounts, ImportDiff } from "@/lib/import/diff";
import { importWarnings } from "@/lib/import/warnings";

const CLEAN = { modelosNoMapeados: [], filasModeloSinMapear: 0, motivosNoMapeados: [], leadsMotivoSinMapear: 0 };
const counts = (c: Partial<DiffCounts> = {}): DiffCounts => ({ inserted: 0, updated: 0, unchanged: 5, deleted: 0, ...c });
const DIFF: ImportDiff = {
  sales: counts(),
  leads: counts(),
  factoryOrders: counts(),
  inventory: counts(),
  economics: counts(),
  bulletins: counts(),
};
const context = (c: Partial<Parameters<typeof importWarnings>[1]> = {}) => ({
  diff: DIFF,
  history: { salesMonths: 36, inventoryMonths: 36 },
  minHistoryMonths: 24,
  ...c,
});

describe("importWarnings", () => {
  it("un archivo limpio con historia suficiente no tiene advertencias", () => {
    expect(importWarnings(CLEAN, context())).toEqual([]);
  });

  it("avisa cuántas filas quedan fuera por modelos sin mapear", () => {
    const warnings = importWarnings({ ...CLEAN, modelosNoMapeados: ["Corolla-Cross", "Land Cruiser"], filasModeloSinMapear: 17 }, context());
    expect(warnings).toEqual(["Modelos sin mapear («Corolla-Cross», «Land Cruiser»): 17 filas quedan fuera del cálculo."]);
  });

  it("avisa cuántos leads no cuentan como pérdida por stock por motivos sin mapear", () => {
    const warnings = importWarnings({ ...CLEAN, motivosNoMapeados: ["Agotado"], leadsMotivoSinMapear: 1 }, context());
    expect(warnings).toEqual(["Motivos de pérdida sin mapear («Agotado»): 1 lead no cuenta como pérdida por falta de stock."]);
  });

  it("avisa si al reemplazar quedaría menos historia de la que necesita el pronóstico", () => {
    const warnings = importWarnings(CLEAN, context({ history: { salesMonths: 3, inventoryMonths: 36 } }));
    expect(warnings).toEqual([
      "Quedarían 3 meses de ventas y 36 meses de inventario; el pronóstico necesita al menos 24: el pedido no sería confiable.",
    ]);
  });

  it("justo en el mínimo no advierte", () => {
    expect(importWarnings(CLEAN, context({ history: { salesMonths: 24, inventoryMonths: 24 } }))).toEqual([]);
  });

  it("avisa si una hoja vacía borraría toda la tabla al reemplazarla", () => {
    const diff = { ...DIFF, leads: counts({ unchanged: 0, deleted: 12072 }) };
    expect(importWarnings(CLEAN, context({ diff }))).toEqual(["La hoja «Leads» viene vacía: reemplazarla eliminaría 12072 filas."]);
  });
});
