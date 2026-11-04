// Puro, sin red ni base. Qué reglas puede omitir el planificador en un cálculo: solo las
// vigentes que no son obligatorias (el lote no se puede omitir, sin él no hay pedido).
import type { ActiveRule } from "@/lib/orders/types";

/** Primer id que no se puede omitir (no existe, no está vigente o es obligatoria), o undefined si todos valen. */
export function findInvalidOmission(rules: ActiveRule[], ids: number[]): number | undefined {
  const omittable = new Set(rules.filter((r) => !r.required).map((r) => r.id));
  return ids.find((id) => !omittable.has(id));
}
