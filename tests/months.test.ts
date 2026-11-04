import { describe, expect, it } from "vitest";
import { addMonths, compareMonthKeys, monthKey, monthOfYear, monthRange, monthsBetween, yearOf } from "@/lib/engine/months";

describe("monthsBetween", () => {
  it("cuenta meses completos entre dos claves, con signo", () => {
    expect(monthsBetween("2026-09", "2027-02")).toBe(5);
    expect(monthsBetween("2026-10", "2026-10")).toBe(0);
    expect(monthsBetween("2027-02", "2026-09")).toBe(-5);
  });
});

describe("months", () => {
  it("extrae la clave de mes de una fecha ISO", () => {
    expect(monthKey("2026-09-30")).toBe("2026-09");
  });

  it("extrae mes y año de una clave", () => {
    expect(monthOfYear("2026-09")).toBe(9);
    expect(yearOf("2026-09")).toBe(2026);
  });

  it("desplaza meses dentro del mismo año", () => {
    expect(addMonths("2026-09", 1)).toBe("2026-10");
    expect(addMonths("2026-09", -1)).toBe("2026-08");
  });

  it("desplaza meses cruzando el fin de año", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -2)).toBe("2025-11");
  });

  it("genera un rango consecutivo de claves de mes", () => {
    expect(monthRange("2026-10", 4)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
    expect(monthRange("2027-02", 3)).toEqual(["2027-02", "2027-03", "2027-04"]);
  });

  it("compara claves de mes cronológicamente", () => {
    expect(compareMonthKeys("2026-09", "2026-10")).toBeLessThan(0);
    expect(compareMonthKeys("2027-01", "2026-12")).toBeGreaterThan(0);
    expect(compareMonthKeys("2026-09", "2026-09")).toBe(0);
  });
});
