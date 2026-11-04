// Puro, sin Next/React/DB. Demanda corregida mensual por modelo:
// ventas sin flotas extraordinarias + leads perdidos por falta de stock
// x tasa de cierre del modelo + demanda que se fue a otro modelo - ventas
// que en realidad eran demanda de otro modelo (sustitución). Ver
// docs/PLAN.md "Lógica del motor de pedido", paso 4.

import { addMonths, monthKey } from "@/lib/engine/months";
import type { EngineLead, EngineSale } from "@/lib/engine/inputs";

export interface MonthlyDemandPoint {
  month: string; // "YYYY-MM"
  baseSales: number; // ventas netas sin flota
  lostStockRecovered: number; // leads perdidos por stock x tasa de cierre
  substitutionRecovered: number; // leads que querían este modelo y compraron otro (demanda de este modelo)
  substitutionRemoved: number; // ventas de este modelo que en realidad eran demanda de otro modelo
  correctedDemand: number;
}

/**
 * Tasa histórica de cierre (ganadas / total) de los leads cuyo modelo
 * de interés es `modelName`. Usada para estimar cuántos de los leads
 * perdidos por falta de stock se habrían convertido en venta.
 */
export function computeCloseRate(modelName: string, leads: EngineLead[]): number {
  let total = 0;
  let won = 0;
  for (const lead of leads) {
    if (lead.modelName !== modelName) continue;
    total += 1;
    if (lead.result === "Ganada") won += 1;
  }
  return total > 0 ? won / total : 0;
}

/**
 * Todos los meses consecutivos desde la primera venta de la base hasta el
 * mes de corte. Los meses sin señal cuentan como demanda 0 (y se pueden
 * imputar si fueron de quiebre), en vez de desaparecer de los promedios.
 */
export function monthsThroughCutoff(sales: EngineSale[], cutoffMonth: string): string[] {
  let first: string | null = null;
  for (const sale of sales) {
    const m = monthKey(sale.date);
    if (m <= cutoffMonth && (first === null || m < first)) first = m;
  }
  if (first === null) return [];
  const months: string[] = [];
  for (let m = first; m <= cutoffMonth; m = addMonths(m, 1)) months.push(m);
  return months;
}

/** Meses (ordenados) en los que hay alguna señal de demanda para el modelo: venta, lead de interés, o sustitución hacia el modelo. */
export function deriveDemandMonths(modelName: string, sales: EngineSale[], leads: EngineLead[]): string[] {
  const months = new Set<string>();
  for (const sale of sales) {
    if (sale.modelName === modelName) months.add(monthKey(sale.date));
  }
  for (const lead of leads) {
    if (lead.closedAt === null) continue;
    if (lead.modelName === modelName || lead.boughtModelName === modelName) {
      months.add(monthKey(lead.closedAt));
    }
  }
  return [...months].sort();
}

/**
 * Serie mensual de demanda corregida para un modelo. `months` por
 * defecto es la unión derivada de ventas y leads del modelo
 * (`deriveDemandMonths`); se puede pasar explícito para forzar un
 * rango (p. ej. en backtests).
 */
export function computeMonthlyCorrectedDemand(
  modelName: string,
  sales: EngineSale[],
  leads: EngineLead[],
  months?: string[],
): MonthlyDemandPoint[] {
  const closeRate = computeCloseRate(modelName, leads);
  const targetMonths = months ?? deriveDemandMonths(modelName, sales, leads);

  return targetMonths.map((month) => {
    let baseSales = 0;
    for (const sale of sales) {
      if (sale.modelName === modelName && !sale.isFleetOutlier && monthKey(sale.date) === month) {
        baseSales += sale.units;
      }
    }

    let lostStockUnits = 0;
    let substitutionOut = 0; // quería este modelo, compró otro
    let substitutionIn = 0; // quería otro modelo, compró este
    for (const lead of leads) {
      if (lead.closedAt === null || monthKey(lead.closedAt) !== month) continue;
      if (
        lead.modelName === modelName &&
        lead.result === "Perdida" &&
        lead.lossReasonCategory === "stock"
      ) {
        lostStockUnits += lead.units;
      }
      const isSubstitution =
        lead.result === "Ganada" &&
        lead.modelName !== null &&
        lead.boughtModelName !== null &&
        lead.modelName !== lead.boughtModelName;
      if (!isSubstitution) continue;
      if (lead.modelName === modelName) substitutionOut += lead.units;
      if (lead.boughtModelName === modelName) substitutionIn += lead.units;
    }

    const lostStockRecovered = lostStockUnits * closeRate;
    // La venta de una sustitución queda en el modelo comprado, pero la demanda original era del modelo de interés.
    const correctedDemand = baseSales + lostStockRecovered + substitutionOut - substitutionIn;

    return {
      month,
      baseSales,
      lostStockRecovered,
      substitutionRecovered: substitutionOut,
      substitutionRemoved: substitutionIn,
      correctedDemand,
    };
  });
}
