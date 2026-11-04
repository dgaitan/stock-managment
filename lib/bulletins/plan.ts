// Puro, sin red ni base. Decisiones de negocio al guardar un comunicado, separadas del
// acceso a datos de service.ts para poder probarlas.

import type { BulletinInput } from "@/lib/bulletins/schemas";
import { PERMANENT_CYCLE } from "@/lib/engine/rules";

interface Vigencia {
  scope: "permanent" | "cycle";
  cycle: string | null;
}

/** Vigencia con la que se guardan las reglas del comunicado en cycle_rules. */
export function ruleCycle(b: Vigencia): string {
  return b.scope === "cycle" && b.cycle ? b.cycle : PERMANENT_CYCLE;
}

interface ExistingBulletin extends Vigencia {
  source: "excel" | "user";
  date: string;
  subject: string;
}

/**
 * Qué cambia al editar un comunicado: la fecha y el asunto de uno del Excel son su identidad
 * (la importación no lo duplica) y no se tocan; si cambia la vigencia, las reglas extraídas
 * dejan de corresponder y hay que extraerlas de nuevo.
 */
export function planBulletinUpdate(existing: ExistingBulletin, input: BulletinInput) {
  const cycle = input.scope === "cycle" ? input.cycle : null;
  const identity = existing.source === "excel" ? { date: existing.date, subject: existing.subject } : input;
  const vigenciaChanged = existing.scope !== input.scope || existing.cycle !== cycle;
  return { cycle, date: identity.date, subject: identity.subject, vigenciaChanged };
}
