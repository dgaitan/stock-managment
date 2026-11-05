// Genera archivos de prueba a partir del Excel del caso para ver qué pasa al
// importar otro archivo. Datos derivados de los ficticios del caso: se escriben en
// data/seed/variants/ (ignorado por git). Uso: bun scripts/variants.ts [xlsx]
//
// 1-correcciones   mismo corte; fábrica retrasa ETA y el CRM reclasifica leads
// 2-siguiente      ciclo siguiente: los 3 meses tras el corte simulados (el corte avanza 3 meses)
// 3-sucio          mismo corte; nombres y motivos nuevos, duplicados, flota, NC
// 4-parcial        solo Leads y Pedidos (export del CRM/ERP), con pedidos cancelados
// 5-ventana-movil  export móvil: sin los 3 meses más antiguos; 20 ventas y 15 leads anulados
// 6-ultimo-trim    solo Ventas e Inventario de los últimos 3 meses (historia insuficiente)

import { mkdirSync } from "node:fs";
import * as XLSX from "xlsx";
import { isFleetOutlier, normalizeLossReason, normalizeModelName } from "@/lib/engine/clean";
import { loadCycleConfig, loadCycleRules } from "@/lib/engine/config";
import { modelNamesFromRules } from "@/lib/engine/rules";

type Row = Record<string, unknown>;
type Sheets = Record<string, Row[]>;

const SRC = process.argv[2] ?? "data/seed/caso1.xlsx";
const OUT = "data/seed/variants";
const MODELS = modelNamesFromRules(loadCycleRules());
const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);
const toSerial = (ms: number) => Math.round((ms - EPOCH) / DAY_MS);
const toDate = (s: number) => new Date(EPOCH + s * DAY_MS);
/** Serial del último día del mes que está `months` meses después del de `s`. */
const monthEndAfter = (s: number, months: number) => toSerial(Date.UTC(toDate(s).getUTCFullYear(), toDate(s).getUTCMonth() + months + 1, 0));
const monthLabel = (s: number) => new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" }).format(toDate(s));
const model = (raw: unknown) => normalizeModelName(String(raw ?? ""), MODELS);
const num = (v: unknown) => Number(v ?? 0);
const isStockLoss = (r: Row) => r["Resultado"] === "Perdida" && normalizeLossReason(String(r["Motivo de pérdida"] ?? "")) === "stock";

const workbook = XLSX.readFile(SRC);
const headers: Record<string, string[]> = {};
const base: Sheets = {};
for (const name of workbook.SheetNames) {
  if (name === "Diccionario") continue;
  const sheet = workbook.Sheets[name];
  headers[name] = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []).map(String);
  base[name] = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
}
const CUTOFF = Math.max(...base["Inventario"].map((r) => num(r["Mes (cierre)"])));
const YEAR_START = toSerial(Date.UTC(toDate(CUTOFF).getUTCFullYear(), 0, 1));
const CYCLE_CONFIG = loadCycleConfig();
const LEAD_TIME_MONTHS = CYCLE_CONFIG.lead_time_months;
let nextInvoice = Math.max(...base["Ventas"].map((r) => num(String(r["Factura"]).replace(/\D/g, "")))) + 1;
let nextLead = Math.max(...base["Leads"].map((r) => num(String(r["ID Oportunidad"]).replace(/\D/g, "")))) + 1;

function write(file: string, sheets: Sheets, note: string) {
  const out = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(out, workbook.Sheets["Diccionario"], "Diccionario");
  for (const name of workbook.SheetNames) {
    if (!sheets[name]) continue;
    XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(sheets[name], { header: headers[name] }), name);
  }
  XLSX.writeFile(out, `${OUT}/${file}`, { compression: true });
  console.log(`${OUT}/${file}\n  ${note}`);
}

const lostLead = (sale: Row, modelName: string, units: number): Row => ({
  "ID Oportunidad": `OPP-${nextLead++}`,
  "Fecha creación": num(sale["Fecha"]) - 7,
  "Fecha cierre": sale["Fecha"],
  Sucursal: sale["Sucursal"],
  Vendedor: sale["Vendedor"],
  "Tipo de cliente": sale["Tipo de cliente"],
  "Modelo de interés": modelName,
  "Versión de interés": sale["Versión"],
  Unidades: units,
  Resultado: "Perdida",
  "Motivo de pérdida": "Sin stock",
  "Modelo comprado (si difiere)": "",
  "Versión comprada (si difiere)": "",
});

// --- 1. Correcciones del mismo ciclo ---
function corrections(): [Sheets, string] {
  const delayed = new Set(["Corolla Cross", "Yaris Cross", "Rush"]);
  let orders = 0;
  const pedidos = base["Pedidos"].map((r) => {
    if (r["Estado"] !== "En tránsito" || !delayed.has(model(r["Modelo"]) ?? "")) return r;
    orders += 1;
    return { ...r, "Fecha estimada de llegada": num(r["Fecha estimada de llegada"]) + 60 };
  });
  const reclassified = new Set<string>();
  const leads = base["Leads"].map((r) => {
    const id = String(r["ID Oportunidad"]);
    const eligible = model(r["Modelo de interés"]) === "Corolla Cross" && isStockLoss(r) && num(r["Fecha creación"]) >= YEAR_START;
    if (!eligible || (reclassified.size >= 30 && !reclassified.has(id))) return r;
    reclassified.add(id);
    return { ...r, "Motivo de pérdida": "Precio" };
  });
  return [{ ...base, Pedidos: pedidos, Leads: leads }, `${orders} líneas en tránsito de Corolla Cross/Yaris Cross/Rush con ETA +60 días; ${reclassified.size} leads de Corolla Cross «sin stock» → «Precio»`];
}

// --- 2. Ciclo siguiente: simula oct-dic con stock real (sin stock, la venta es lead perdido) ---
// Pedido que `bun run pedido` recomienda con el Excel base: en el ciclo siguiente ya va en tránsito.
const CURRENT_ORDER: Record<string, number> = {
  Hilux: 48, Fortuner: 32, Corolla: 30, "Corolla Cross": 108, Yaris: 16, "Yaris Cross": 72,
  "Land Cruiser Prado": 14, Rush: 44, Hiace: 30, Raize: 18,
};

function nextCycle(): [Sheets, string] {
  type Lot = { model: string; version: string; color: string; units: number; age: number };
  const stock = new Map<string, Lot>();
  const keyOf = (m: string, v: unknown, c: unknown) => `${m}|${v}|${c}`;
  for (const r of base["Inventario"].filter((r) => num(r["Mes (cierre)"]) === CUTOFF)) {
    const m = model(r["Modelo"]);
    if (m) stock.set(keyOf(m, r["Versión"], r["Color"]), { model: m, version: String(r["Versión"]), color: String(r["Color"]), units: num(r["Unidades"]), age: num(r["Antigüedad promedio (días)"]) });
  }
  const pedidos = base["Pedidos"].map((r) => ({ ...r }));
  const sales: Row[] = [];
  const leads: Row[] = [];
  const inventory: Row[] = [];
  const monthEnds = [1, 2, 3].map((n) => monthEndAfter(CUTOFF, n));
  let start = CUTOFF + 1;
  let lost = 0;

  for (const end of monthEnds) {
    for (const lot of stock.values()) lot.age += end - start + 1;
    for (const order of pedidos) {
      if (order["Estado"] !== "En tránsito" || num(order["Fecha estimada de llegada"]) > end) continue;
      const m = model(order["Modelo"]);
      if (!m) continue;
      const received = Math.max(num(order["Fecha estimada de llegada"]), start);
      Object.assign(order, { Estado: "Recibido", "Fecha de recepción": received });
      const key = keyOf(m, order["Versión"], order["Color"]);
      const lot = stock.get(key) ?? { model: m, version: String(order["Versión"]), color: String(order["Color"]), units: 0, age: 0 };
      const units = num(order["Unidades"]);
      lot.age = lot.units + units === 0 ? 0 : (lot.units * lot.age + units * (end - received)) / (lot.units + units);
      lot.units += units;
      stock.set(key, lot);
    }
    const templates = base["Ventas"].filter((r) => {
      const d = num(r["Fecha"]) + 365;
      return d >= start && d <= end && num(r["Unidades"]) > 0 && !isFleetOutlier(String(r["Tipo de cliente"] ?? ""), num(r["Unidades"]), CYCLE_CONFIG.fleet_outlier_min_units);
    });
    for (const t of templates) {
      const m = model(t["Modelo"]);
      if (!m) continue;
      const exact = stock.get(keyOf(m, t["Versión"], t["Color"]));
      const lot = exact && exact.units > 0 ? exact : [...stock.values()].find((l) => l.model === m && l.units > 0);
      const want = num(t["Unidades"]);
      const sold = Math.min(want, lot?.units ?? 0);
      if (lot && sold > 0) {
        lot.units -= sold;
        sales.push({ ...t, Fecha: num(t["Fecha"]) + 365, Factura: `FAC-${nextInvoice++}`, Modelo: m, Versión: lot.version, Color: lot.color, Unidades: sold, Nota: "" });
      }
      if (want > sold) {
        leads.push(lostLead({ ...t, Fecha: num(t["Fecha"]) + 365 }, m, want - sold));
        lost += want - sold;
      }
    }
    for (const t of base["Leads"].filter((r) => num(r["Fecha creación"]) + 365 >= start && num(r["Fecha creación"]) + 365 <= end && !isStockLoss(r))) {
      const closed = num(t["Fecha cierre"]);
      leads.push({ ...t, "ID Oportunidad": `OPP-${nextLead++}`, "Fecha creación": num(t["Fecha creación"]) + 365, "Fecha cierre": closed ? closed + 365 : "" });
    }
    for (const lot of stock.values()) {
      if (lot.units > 0) inventory.push({ "Mes (cierre)": end, Modelo: lot.model, Versión: lot.version, Color: lot.color, Unidades: lot.units, "Antigüedad promedio (días)": Math.round(lot.age) });
    }
    start = end + 1;
  }

  const lastYear = base["Ventas"].filter((r) => num(r["Fecha"]) > CUTOFF - 365);
  const topVersion = (m: string) => {
    const counts = new Map<string, number>();
    for (const r of lastYear) if (model(r["Modelo"]) === m) counts.set(String(r["Versión"]), (counts.get(String(r["Versión"])) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  };
  const currentOrder = Object.entries(CURRENT_ORDER).map(([m, units]) => ({
    "No. pedido": "PF-50001", "Fecha pedido": monthEndAfter(CUTOFF, 1) - 3, Modelo: m, Versión: topVersion(m), Color: "Blanco",
    Unidades: units, "Fecha estimada de llegada": monthEndAfter(CUTOFF, 1 + LEAD_TIME_MONTHS) - 13, Estado: "En tránsito", "Fecha de recepción": "",
  }));
  const bulletin = {
    Fecha: monthEndAfter(CUTOFF, 3) - 23,
    Emisor: "Toyota Motor Corporation - Oficina Regional Centroamérica y Caribe",
    Asunto: `Ajuste de lotes para la ventana de ${monthLabel(monthEndAfter(CUTOFF, 4))}`,
    Texto: `A partir de la ventana de ${monthLabel(monthEndAfter(CUTOFF, 4))} el pedido mínimo de Hilux sube a 18 unidades, en múltiplos de 6. El resto de los lotes no cambia.`,
  };
  return [
    {
      ...base,
      Ventas: [...base["Ventas"], ...sales],
      Leads: [...base["Leads"], ...leads],
      Pedidos: [...pedidos, ...currentOrder],
      Inventario: [...base["Inventario"], ...inventory],
      Comunicados: [...base["Comunicados"], bulletin],
    },
    `+${sales.length} ventas, +${leads.length} leads (${lost} u. perdidas por falta de stock), 3 cierres de mes, pedido vigente (${Object.values(CURRENT_ORDER).reduce((a, b) => a + b, 0)} u.) en tránsito, comunicado nuevo de lotes`,
  ];
}

// --- 3. Archivo sucio del mismo ciclo ---
function dirty(): [Sheets, string] {
  const template = (m: string) => base["Ventas"].findLast((r) => model(r["Modelo"]) === m)!;
  const day = CUTOFF - 5;
  const sale = (m: string, raw: string, extra: Row = {}): Row => ({ ...template(m), Fecha: day, Factura: `FAC-${nextInvoice++}`, Modelo: raw, Nota: "", ...extra });
  const added = [
    ...Array.from({ length: 12 }, () => sale("Corolla Cross", "Corolla-Cross")),
    ...Array.from({ length: 5 }, () => sale("Land Cruiser Prado", "Land Cruiser")),
    ...Array.from({ length: 6 }, () => sale("Hilux", "  toyota HILUX ", { Sucursal: "Mgua. Central" })),
    sale("Hilux", "Hilux", { "Tipo de cliente": "Flota / Institucional", Cliente: "Ministerio de Salud (ficticio)", Unidades: 30 }),
  ];
  const refund = { ...added[12 + 5], Factura: `NC-${nextInvoice++}`, Unidades: -1, Nota: `Devolución ref. ${added[12 + 5]["Factura"]}` };
  const duplicates = base["Ventas"].slice(-10);
  const leadTemplate = (m: string) => base["Leads"].findLast((r) => model(r["Modelo de interés"]) === m)!;
  const lead = (m: string, reason: string): Row => ({
    ...leadTemplate(m), "ID Oportunidad": `OPP-${nextLead++}`, "Fecha creación": day - 10, "Fecha cierre": day,
    Resultado: "Perdida", "Motivo de pérdida": reason, "Modelo comprado (si difiere)": "", "Versión comprada (si difiere)": "",
  });
  const conflicting = { ...base["Leads"].at(-1)!, Resultado: "Ganada", "Motivo de pérdida": "" };
  return [
    {
      ...base,
      Ventas: [...base["Ventas"], ...duplicates, ...added, refund],
      Leads: [
        ...base["Leads"],
        ...Array.from({ length: 40 }, () => lead("Rush", "Agotado")),
        ...Array.from({ length: 20 }, () => lead("Yaris Cross", "Sin stock")),
        conflicting,
      ],
    },
    "10 ventas duplicadas; 12 «Corolla-Cross» y 5 «Land Cruiser» (sin mapear); 6 «  toyota HILUX » en «Mgua. Central»; flota Hilux de 30; 1 NC; 40 leads Rush «Agotado» (motivo nuevo); 20 Yaris Cross «Sin stock»; 1 ID de lead repetido con otro resultado",
  ];
}

// --- 4. Export parcial: solo Leads y Pedidos ---
function partial(): [Sheets, string] {
  let cancelled = 0;
  const pedidos = base["Pedidos"].map((r) => {
    if (r["Estado"] !== "En tránsito" || model(r["Modelo"]) !== "Hilux" || cancelled >= 10) return r;
    cancelled += 1;
    return { ...r, Estado: "Cancelado" };
  });
  return [{ Leads: base["Leads"], Pedidos: pedidos }, `sin Ventas, Inventario, Economía ni Comunicados; ${cancelled} líneas Hilux en tránsito pasan a «Cancelado»`];
}

// --- 5. Export móvil: el ERP ya no trae los meses más antiguos ni lo anulado ---
function rollingWindow(): [Sheets, string] {
  const oldest = Math.min(...base["Inventario"].map((r) => num(r["Mes (cierre)"])));
  const dropBefore = monthEndAfter(oldest, 2); // los 3 meses más antiguos
  const recent = (date: unknown) => num(date) > dropBefore;
  const voidedSales = new Set(
    base["Ventas"].filter((r) => model(r["Modelo"]) === "Hilux" && num(r["Fecha"]) >= YEAR_START && num(r["Unidades"]) > 0).slice(0, 20),
  );
  const voidedLeads = new Set(base["Leads"].filter((r) => model(r["Modelo de interés"]) === "Corolla Cross" && isStockLoss(r)).slice(-15).map((r) => r["ID Oportunidad"]));
  return [
    {
      ...base,
      Ventas: base["Ventas"].filter((r) => recent(r["Fecha"]) && !voidedSales.has(r)),
      Leads: base["Leads"].filter((r) => recent(r["Fecha creación"]) && !voidedLeads.has(r["ID Oportunidad"])),
      Inventario: base["Inventario"].filter((r) => recent(r["Mes (cierre)"])),
      Pedidos: base["Pedidos"].filter((r) => recent(r["Fecha pedido"])),
    },
    `sin los meses hasta el ${new Date(EPOCH + dropBefore * DAY_MS).toISOString().slice(0, 10)}; ${voidedSales.size} ventas Hilux y ${voidedLeads.size} leads Corolla Cross «sin stock» anulados`,
  ];
}

// --- 6. Solo el último trimestre de Ventas e Inventario ---
function lastQuarter(): [Sheets, string] {
  const since = monthEndAfter(CUTOFF, -3);
  return [
    {
      Ventas: base["Ventas"].filter((r) => num(r["Fecha"]) > since),
      Inventario: base["Inventario"].filter((r) => num(r["Mes (cierre)"]) > since),
    },
    "solo Ventas e Inventario de los 3 meses previos al corte",
  ];
}

mkdirSync(OUT, { recursive: true });
for (const [file, build] of [
  ["1-correcciones.xlsx", corrections],
  ["2-siguiente-ciclo.xlsx", nextCycle],
  ["3-sucio.xlsx", dirty],
  ["4-parcial.xlsx", partial],
  ["5-ventana-movil.xlsx", rollingWindow],
  ["6-ultimo-trimestre.xlsx", lastQuarter],
] as const) {
  const [sheets, note] = build();
  write(file, sheets, note);
}
