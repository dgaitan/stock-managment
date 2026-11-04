import { describe, expect, it } from "vitest";
import { findInvalidOmission } from "@/lib/orders/omittable";
import type { ActiveRule } from "@/lib/orders/types";
import { REQUIRED_RULE_KEYS } from "@/lib/engine/rules";

const rule = (id: number, key: string, required: boolean): ActiveRule => ({
  id,
  model: "RAV4",
  key,
  value: "1",
  cycle: "permanent",
  bulletin: null,
  required,
});
const rules = [rule(1, "lot_min", true), rule(2, "lot_multiple", true), rule(3, "lifecycle", false)];

describe("findInvalidOmission", () => {
  it("permite omitir una regla opcional vigente y no omitir ninguna", () => {
    expect(findInvalidOmission(rules, [3])).toBeUndefined();
    expect(findInvalidOmission(rules, [])).toBeUndefined();
  });

  it("rechaza las reglas de lote, aunque vengan mezcladas con válidas", () => {
    expect(findInvalidOmission(rules, [3, 1])).toBe(1);
    expect(findInvalidOmission(rules, [2])).toBe(2);
  });

  it("rechaza un id que no existe o que no está vigente", () => {
    expect(findInvalidOmission(rules, [99])).toBe(99);
  });
});

describe("REQUIRED_RULE_KEYS", () => {
  it("son exactamente el lote mínimo y el múltiplo", () => {
    expect([...REQUIRED_RULE_KEYS].sort()).toEqual(["lot_min", "lot_multiple"]);
  });
});
