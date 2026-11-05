import { describe, expect, it } from "vitest";
import { allOmitted, groupRulesByBulletin, isGroupActive } from "@/lib/orders/ruleGroups";
import type { ActiveRule } from "@/lib/orders/types";

const rule = (id: number, required: boolean, subject: string | null): ActiveRule => ({
  id,
  model: "RAV4",
  key: required ? "lot_min" : "lifecycle",
  value: "4",
  cycle: "permanent",
  bulletin: subject ? { subject, date: "2026-09-15" } : null,
  required,
});

describe("groupRulesByBulletin + isGroupActive", () => {
  const groups = groupRulesByBulletin([rule(1, true, "Lotes"), rule(2, false, "RAV4"), rule(3, false, "RAV4"), rule(4, false, null)]);

  it("agrupa por comunicado y separa lotes obligatorios", () => {
    expect(groups.map((g) => [g.title, g.required, g.optional.length, g.fromBulletin])).toEqual([
      ["Lotes", 1, 0, true],
      ["RAV4", 0, 2, true],
      ["Reglas iniciales", 0, 1, false],
    ]);
  });

  it("un comunicado solo con lotes siempre está activo", () => {
    expect(isGroupActive(groups[0], [1])).toBe(true);
  });

  it("un comunicado se desactiva solo si todas sus reglas están omitidas", () => {
    expect(isGroupActive(groups[1], [2])).toBe(true);
    expect(isGroupActive(groups[1], [2, 3])).toBe(false);
  });

  it("allOmitted no considera omitido un conjunto vacío", () => {
    expect(allOmitted([], [1])).toBe(false);
    expect(allOmitted([2, 3], [3, 2, 9])).toBe(true);
  });
});
