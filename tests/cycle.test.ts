import { describe, expect, it } from "vitest";
import { deriveCycle, lastBusinessDay, latestInventoryMonthEnd } from "@/lib/engine/cycle";

const WINDOWS = [1, 4, 7, 10];

describe("lastBusinessDay", () => {
  it("retrocede del sábado 31 al viernes 30 (oct-2026, como dice la gerencia)", () => {
    expect(lastBusinessDay("2026-10")).toBe("2026-10-30");
  });
  it("retrocede del domingo al viernes", () => {
    expect(lastBusinessDay("2027-01")).toBe("2027-01-29"); // 31-ene-2027 es domingo
  });
  it("deja el último día si ya es hábil", () => {
    expect(lastBusinessDay("2026-09")).toBe("2026-09-30"); // miércoles
  });
});

describe("deriveCycle", () => {
  it("corte 30/09/2026 -> ventana oct-2026, llega feb-2027, cubre feb-abr", () => {
    const cycle = deriveCycle({ cutoffDate: "2026-09-30", leadTimeMonths: 4, windowMonths: WINDOWS });
    expect(cycle).toEqual({
      cutoffDate: "2026-09-30",
      window: "2026-10",
      windowCloses: "2026-10-30",
      arrivalMonth: "2027-02",
      gapMonths: ["2026-10", "2026-11", "2026-12", "2027-01"],
      coverageMonths: ["2027-02", "2027-03", "2027-04"],
    });
  });

  it("el ciclo siguiente sale solo de un corte más nuevo (dic-2026 -> ventana ene-2027, llega may-2027)", () => {
    const cycle = deriveCycle({ cutoffDate: "2026-12-31", leadTimeMonths: 4, windowMonths: WINDOWS });
    expect(cycle.window).toBe("2027-01");
    expect(cycle.arrivalMonth).toBe("2027-05");
    expect(cycle.gapMonths).toEqual(["2027-01", "2027-02", "2027-03", "2027-04"]);
    expect(cycle.coverageMonths).toEqual(["2027-05", "2027-06", "2027-07"]);
  });

  it("con un corte a mitad de trimestre, los meses hasta la llegada se alargan", () => {
    const cycle = deriveCycle({ cutoffDate: "2026-08-31", leadTimeMonths: 4, windowMonths: WINDOWS });
    expect(cycle.window).toBe("2026-10");
    expect(cycle.gapMonths).toEqual(["2026-09", "2026-10", "2026-11", "2026-12", "2027-01"]);
  });

  it("si el corte cae en un mes de ventana, esa ventana ya cerró y toca la siguiente", () => {
    expect(deriveCycle({ cutoffDate: "2026-10-31", leadTimeMonths: 4, windowMonths: WINDOWS }).window).toBe("2027-01");
  });

  it("la cobertura sigue el espacio entre ventanas configurado (semestral = 6 meses)", () => {
    const cycle = deriveCycle({ cutoffDate: "2026-09-30", leadTimeMonths: 4, windowMonths: [4, 10] });
    expect(cycle.coverageMonths).toHaveLength(6);
  });

  it("rechaza un lead time inválido y ventanas sin meses válidos", () => {
    expect(() => deriveCycle({ cutoffDate: "2026-09-30", leadTimeMonths: 0, windowMonths: WINDOWS })).toThrow(/lead_time/);
    expect(() => deriveCycle({ cutoffDate: "2026-09-30", leadTimeMonths: 4, windowMonths: [] })).toThrow(/window_months/);
  });
});

describe("latestInventoryMonthEnd", () => {
  it("es el cierre más reciente, sin importar el orden", () => {
    expect(latestInventoryMonthEnd([{ monthEnd: "2026-08-31" }, { monthEnd: "2026-09-30" }, { monthEnd: "2026-07-31" }])).toBe("2026-09-30");
  });
  it("sin inventario no hay corte: error explícito", () => {
    expect(() => latestInventoryMonthEnd([])).toThrow(/inventario/);
  });
});
