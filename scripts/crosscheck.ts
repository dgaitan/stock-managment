// Validación cruzada INDEPENDIENTE del motor. Recalcula cifras clave leyendo
// el xlsx crudo con SheetJS y su propia limpieza mínima. El lado independiente
// no usa lib/sources ni lib/engine; solo los importa al final para comparar.
// Uso: bun run crosscheck [-- archivo.xlsx]. Sale con código 1 si algo no cuadra.

import * as XLSX from "xlsx";
import { computeModelOrderPlan, type ModelOrderPlan } from "@/lib/engine/order";
import { loadCaseContext } from "./caseContext";

type Row = Record<string, string | number>;
const file = process.argv[2] ?? "data/seed/caso1.xlsx";
const wb = XLSX.readFile(file);
const sheet = (name: string) => XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { raw: true });

const { config, parsed, cycle, models, economicsByModel } = loadCaseContext(file);
const MODELS = models.map((m) => m.name);

// --- limpieza mínima propia ---
const serialToIso = (n: number) => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);
const monthOf = (iso: string) => iso.slice(0, 7);
// el corte es el último cierre de la hoja Inventario (el motor lo deriva de los datos normalizados)
const CUTOFF = serialToIso(Math.max(...sheet("Inventario").map((r) => Number(r["Mes (cierre)"]))));
const canon = new Map(MODELS.map((m) => [m.toLowerCase(), m]));
function model(raw: unknown): string | null {
  const key = String(raw ?? "").trim().replace(/\s+/g, " ").replace(/^toyota\s+/i, "").toLowerCase();
  return canon.get(key) ?? null;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

// --- ventas: dedupe por línea completa, notas de crédito ya vienen en -1 ---
const rawSales = sheet("Ventas");
const seenLines = new Set<string>();
const sales = rawSales.filter((r) => {
  const key = JSON.stringify(r);
  if (seenLines.has(key)) return false;
  seenLines.add(key);
  return true;
});
const duplicates = rawSales.length - sales.length;
const creditNotes = sales.filter((r) => String(r["Factura"]).startsWith("NC-")).length;
const isFleet = (r: Row) => r["Tipo de cliente"] === "Flota / Institucional" && Number(r["Unidades"]) >= config.fleet_outlier_min_units;
const salesIn = (m: string, month: string, includeFleet = false) =>
  sum(
    sales
      .filter((r) => model(r["Modelo"]) === m && monthOf(serialToIso(Number(r["Fecha"]))) === month && (includeFleet || !isFleet(r)))
      .map((r) => Number(r["Unidades"])),
  );

// --- leads: un ID Oportunidad repetido es la misma oportunidad ---
const rawLeads = sheet("Leads");
const seenLeadIds = new Set<string>();
const leads = rawLeads.filter((l) => {
  const id = String(l["ID Oportunidad"]);
  if (seenLeadIds.has(id)) return false;
  seenLeadIds.add(id);
  return true;
});
const STOCK_REASON = /sin disponibilidad|sin inventario|sin stock|no hay unidades|no disponible/i;
const closeRate = (m: string) => {
  const mine = leads.filter((l) => model(l["Modelo de interés"]) === m);
  return mine.length ? mine.filter((l) => l["Resultado"] === "Ganada").length / mine.length : 0;
};
function correctedDemand(m: string, month: string): number {
  let lost = 0;
  let subIn = 0;
  let subOut = 0;
  for (const l of leads) {
    if (!l["Fecha cierre"] || monthOf(serialToIso(Number(l["Fecha cierre"]))) !== month) continue;
    const interest = model(l["Modelo de interés"]);
    const bought = model(l["Modelo comprado (si difiere)"]);
    const units = Number(l["Unidades"]);
    if (interest === m && l["Resultado"] === "Perdida" && STOCK_REASON.test(String(l["Motivo de pérdida"]))) lost += units;
    if (l["Resultado"] === "Ganada" && interest && bought && interest !== bought) {
      if (bought === m) subIn += units;
      if (interest === m) subOut += units;
    }
  }
  return salesIn(m, month) + lost * closeRate(m) + subOut - subIn;
}
// Inventario y pedidos se leen una sola vez
const inventoryRows = sheet("Inventario");
const orderRows = sheet("Pedidos");
const closingStock = (m: string, month: string) =>
  sum(inventoryRows.filter((r) => model(r["Modelo"]) === m && monthOf(serialToIso(Number(r["Mes (cierre)"]))) === month).map((r) => Number(r["Unidades"])));

// Historia mensual completa (desde la primera venta hasta el corte) con imputación de quiebres,
// recalculada aquí con su propia lógica: mes de quiebre = stock al cierre (0 si no hay foto) < fracción x venta media.
const allMonths = (() => {
  const first = sales.map((r) => monthOf(serialToIso(Number(r["Fecha"])))).sort()[0];
  const out: string[] = [];
  let [year, month] = first.split("-").map(Number);
  while (`${year}-${String(month).padStart(2, "0")}` <= monthOf(CUTOFF)) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }
  return out;
})();
function imputedHistory(m: string): { month: string; value: number; imputed: boolean }[] {
  const corrected = allMonths.map((mm) => ({ month: mm, value: correctedDemand(m, mm) }));
  const monthsWithSales = new Set(sales.filter((r) => model(r["Modelo"]) === m && !isFleet(r)).map((r) => monthOf(serialToIso(Number(r["Fecha"])))));
  const avgNetSales = avg([...monthsWithSales].map((mm) => salesIn(m, mm)));
  const stockout = (mm: string) => closingStock(m, mm) < avgNetSales * config.stockout_min_stock_fraction;
  const healthy = corrected.filter((c) => !stockout(c.month));
  if (healthy.length === 0 || healthy.length === corrected.length) return corrected.map((c) => ({ ...c, imputed: false }));
  const baseline = avg(healthy.map((c) => c.value));
  return corrected.map((c) => (stockout(c.month) && c.value < baseline ? { month: c.month, value: baseline, imputed: true } : { ...c, imputed: false }));
}
function baseRate(m: string): { rate: number; imputedMonths: number } {
  const series = imputedHistory(m);
  const recent = series.slice(-6).map((c) => c.value);
  const prior = series.slice(-12, -6).map((c) => c.value);
  const rate = config.forecast_weights.recent_6m * avg(recent) + config.forecast_weights.prior_6m * avg(prior);
  return { rate, imputedMonths: series.filter((c) => c.imputed).length };
}

// --- patio y tránsito: tránsito por columna Estado (el motor lo deduce por fechas) ---
const cutoffMonth = monthOf(CUTOFF);
const yard = (m: string) =>
  closingStock(m, cutoffMonth);
const transit = (m: string) =>
  sum(orderRows.filter((r) => model(r["Modelo"]) === m && r["Estado"] === "En tránsito").map((r) => Number(r["Unidades"])));

// --- lotes: leídos del TEXTO del comunicado, no de cycle.yaml ---
const lotsText = sheet("Comunicados").map((r) => String(r["Texto"])).find((t) => /pedido mínimo/i.test(t)) ?? "";
const lots = new Map<string, { min: number; mult: number }>();
for (const m of MODELS) {
  const hit = new RegExp(`${m}\\s+(\\d+)\\s*/\\s*(\\d+)`).exec(lotsText);
  if (hit) lots.set(m, { min: Number(hit[1]), mult: Number(hit[2]) });
}

// --- motor ---
const plans = new Map<string, ModelOrderPlan>(
  models.map((model) => {
    const economics = economicsByModel.get(model.name) ?? { unitCost: 0, marginPct: 0, monthlyFinCost: 0 };
    const { sales, leads, inventory, factoryOrders } = parsed;
    return [model.name, computeModelOrderPlan({ config, cycle, model, economics, sales, leads, inventory, factoryOrders })];
  }),
);

// --- comparaciones ---
interface Check { check: string; independent: string | number; engine: string | number; ok: boolean }
const checks: Check[] = [];
const add = (check: string, independent: number | string, engine: number | string, tol = 0) =>
  checks.push({ check, independent, engine, ok: typeof independent === "number" && typeof engine === "number" ? Math.abs(independent - engine) <= tol : independent === engine });

// ciclo: el corte sale de la hoja Inventario cruda; el cierre de la ventana, del texto del comunicado de la gerencia
const SPANISH_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const closeMatch = /ventana que cierra el (\d{1,2}) de (\w+) de (\d{4})/i.exec(sheet("Comunicados").map((r) => String(r["Texto"])).join("\n"));
const bulletinClose = closeMatch
  ? `${closeMatch[3]}-${String(SPANISH_MONTHS.indexOf(closeMatch[2].toLowerCase()) + 1).padStart(2, "0")}-${closeMatch[1].padStart(2, "0")}`
  : "sin comunicado";
add("Corte del ciclo (último cierre de Inventario)", CUTOFF, cycle.cutoffDate);
add("Cierre de la ventana vs comunicado de la gerencia", bulletinClose, cycle.windowCloses);
add("Facturas duplicadas eliminadas", duplicates, parsed.stats.ventasDuplicadosEliminados);
add("Notas de crédito aplicadas", creditNotes, parsed.stats.ventasNotasCreditoAplicadas);
add("Leads duplicados eliminados", rawLeads.length - leads.length, parsed.stats.leadsDuplicadosEliminados);
add("Líneas de venta con modelo sin mapear", sales.filter((r) => !model(r["Modelo"])).length, parsed.stats.modelosNoMapeados.length);
add("Modelos distintos tras normalizar", new Set(sales.map((r) => model(r["Modelo"])).filter(Boolean)).size, parsed.stats.modelosDetectados);
add("Patio total al corte", sum(MODELS.map(yard)), sum([...plans.values()].map((p) => p.patioAtCutoff)));
add("Tránsito total al corte", sum(MODELS.map(transit)), sum([...plans.values()].map((p) => p.transitoAtCutoff)));
for (const m of MODELS) {
  add(`Patio+tránsito ${m}`, yard(m) + transit(m), plans.get(m)!.patioAtCutoff + plans.get(m)!.transitoAtCutoff);
}
add("Ventas netas Hilux mar-2026 (con flota)", salesIn("Hilux", "2026-03", true), sum(parsed.sales.filter((s) => s.modelName === "Hilux" && s.date.startsWith("2026-03")).map((s) => s.units)));
// demanda base (antes de estacionalidad) de los 11 modelos, con corrección e imputación recalculadas aquí
for (const m of MODELS) {
  const mine = baseRate(m);
  add(`Tasa mensual base ${m}`, Number(mine.rate.toFixed(2)), Number(plans.get(m)!.forecastMonthlyRate.toFixed(2)), 0.05);
  add(`Meses de quiebre imputados ${m}`, mine.imputedMonths, plans.get(m)!.imputedStockoutMonths);
}
for (const m of MODELS) {
  const lot = lots.get(m);
  const units = plans.get(m)!.orderUnits;
  const ok = lot !== undefined && (units === 0 || (units >= lot.min && units % lot.mult === 0));
  checks.push({ check: `Pedido ${m} cumple lote del comunicado`, independent: lot ? `${lot.min}/${lot.mult}` : "sin regla", engine: units, ok });
}

console.table(checks.map((c) => ({ Verificación: c.check, Independiente: c.independent, Motor: c.engine, OK: c.ok ? "✓" : "✗ DIFIERE" })));
const failed = checks.filter((c) => !c.ok);
console.log(failed.length === 0 ? `\nTodas las ${checks.length} verificaciones cuadran.` : `\n${failed.length} de ${checks.length} verificaciones NO cuadran.`);
process.exit(failed.length === 0 ? 0 : 1);
