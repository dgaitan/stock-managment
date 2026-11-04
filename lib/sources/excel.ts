import * as XLSX from "xlsx";
import {
  computeLineHash,
  isCreditNote,
  isFleetOutlier,
  normalizeBranchName,
  normalizeLossReason,
  normalizeModelName,
} from "@/lib/engine/clean";
import { sheetRows, toISODate, toNumber, toText } from "@/lib/sources/cells";
import type {
  ImportStats,
  NormalizedBulletin,
  NormalizedFactoryOrder,
  NormalizedImport,
  NormalizedInventorySnapshot,
  NormalizedLead,
  NormalizedModelEconomics,
  NormalizedSale,
} from "@/lib/sources/types";

const DEFAULT_FLEET_OUTLIER_MIN_UNITS = 10;

// Columnas de Leads que definen el contenido de una oportunidad (su line_hash).
const LEAD_COLUMNS = [
  "Fecha creación",
  "Fecha cierre",
  "Sucursal",
  "Vendedor",
  "Tipo de cliente",
  "Modelo de interés",
  "Versión de interés",
  "Unidades",
  "Resultado",
  "Motivo de pérdida",
  "Modelo comprado (si difiere)",
  "Versión comprada (si difiere)",
] as const;

interface ParseOptions {
  fleetOutlierMinUnits?: number;
}

export function parseWorkbook(
  workbook: XLSX.WorkBook,
  canonicalModels: readonly string[],
  options: ParseOptions = {},
): NormalizedImport {
  const fleetOutlierMinUnits = options.fleetOutlierMinUnits ?? DEFAULT_FLEET_OUTLIER_MIN_UNITS;
  const modelosNoMapeados = new Set<string>();

  function resolveModel(raw: unknown): { raw: string; normalized: string | null } {
    const rawText = toText(raw) ?? "";
    const normalized = normalizeModelName(rawText, canonicalModels);
    if (rawText && !normalized) modelosNoMapeados.add(rawText);
    return { raw: rawText, normalized };
  }

  // --- Ventas ---
  const ventasRows = sheetRows(workbook, "Ventas");
  const seenSaleHashes = new Set<string>();
  let duplicadosEliminados = 0;
  let notasCreditoAplicadas = 0;
  const sales: NormalizedSale[] = [];

  for (const row of ventasRows) {
    const invoice = toText(row["Factura"]) ?? "";
    const date = toISODate(row["Fecha"]) ?? "";
    const branchNameRaw = toText(row["Sucursal"]);
    const branchName = normalizeBranchName(branchNameRaw);
    const seller = toText(row["Vendedor"]);
    const customerType = toText(row["Tipo de cliente"]);
    const customer = toText(row["Cliente"]);
    const model = resolveModel(row["Modelo"]);
    const version = toText(row["Versión"]);
    const color = toText(row["Color"]);
    const units = toNumber(row["Unidades"]) ?? 0;
    const unitPrice = toNumber(row["Precio unitario (USD)"]);
    const note = toText(row["Nota"]);
    const creditNote = isCreditNote(invoice);

    const lineHash = computeLineHash([
      invoice,
      date,
      branchNameRaw,
      seller,
      customerType,
      customer,
      model.raw,
      version,
      color,
      units,
      unitPrice,
      note,
    ]);

    if (seenSaleHashes.has(lineHash)) {
      duplicadosEliminados += 1;
      continue;
    }
    seenSaleHashes.add(lineHash);
    if (creditNote) notasCreditoAplicadas += 1;

    sales.push({
      invoice,
      businessKey: computeLineHash([invoice, model.normalized ?? model.raw, version, color]),
      lineHash,
      date,
      branchNameRaw,
      branchName,
      seller,
      customerType,
      customer,
      modelNameRaw: model.raw,
      modelName: model.normalized,
      version,
      color,
      units,
      unitPrice,
      note,
      isCreditNote: creditNote,
      isFleetOutlier: isFleetOutlier(customerType, units, fleetOutlierMinUnits),
    });
  }

  // --- Inventario ---
  const inventory: NormalizedInventorySnapshot[] = sheetRows(workbook, "Inventario").map((row) => {
    const model = resolveModel(row["Modelo"]);
    return {
      monthEnd: toISODate(row["Mes (cierre)"]) ?? "",
      modelNameRaw: model.raw,
      modelName: model.normalized,
      version: toText(row["Versión"]),
      color: toText(row["Color"]),
      units: toNumber(row["Unidades"]) ?? 0,
      avgAgeDays: toNumber(row["Antigüedad promedio (días)"]),
    };
  });

  // --- Leads ---
  // Un ID Oportunidad repetido es la misma oportunidad: se conserva la primera
  // fila para no contar dos veces una venta perdida o una sustitución.
  const leadRows = sheetRows(workbook, "Leads");
  const leadRowsById = new Map<string, (typeof leadRows)[number]>();
  for (const row of leadRows) {
    const id = toText(row["ID Oportunidad"]) ?? "";
    if (!leadRowsById.has(id)) leadRowsById.set(id, row);
  }
  const leads: NormalizedLead[] = [...leadRowsById].map(([externalId, row]) => {
    const model = resolveModel(row["Modelo de interés"]);
    const boughtRaw = toText(row["Modelo comprado (si difiere)"]);
    const bought = boughtRaw ? resolveModel(boughtRaw) : null;
    const lossReasonRaw = toText(row["Motivo de pérdida"]);
    const branchNameRaw = toText(row["Sucursal"]);
    return {
      externalId,
      lineHash: computeLineHash(LEAD_COLUMNS.map((column) => toText(row[column]))),
      createdAt: toISODate(row["Fecha creación"]),
      closedAt: toISODate(row["Fecha cierre"]),
      branchNameRaw,
      branchName: normalizeBranchName(branchNameRaw),
      seller: toText(row["Vendedor"]),
      customerType: toText(row["Tipo de cliente"]),
      modelNameRaw: model.raw,
      modelName: model.normalized,
      version: toText(row["Versión de interés"]),
      units: toNumber(row["Unidades"]) ?? 1,
      result: toText(row["Resultado"]),
      lossReasonRaw,
      lossReasonCategory: normalizeLossReason(lossReasonRaw),
      boughtModelNameRaw: bought?.raw ?? null,
      boughtModelName: bought?.normalized ?? null,
      boughtVersion: toText(row["Versión comprada (si difiere)"]),
    };
  });

  // --- Pedidos (factory orders) ---
  const factoryOrders: NormalizedFactoryOrder[] = sheetRows(workbook, "Pedidos").map((row) => {
    const model = resolveModel(row["Modelo"]);
    const orderNo = toText(row["No. pedido"]) ?? "";
    const orderDate = toISODate(row["Fecha pedido"]);
    const version = toText(row["Versión"]);
    const color = toText(row["Color"]);
    const units = toNumber(row["Unidades"]) ?? 0;
    const eta = toISODate(row["Fecha estimada de llegada"]);
    const status = toText(row["Estado"]);
    const receivedAt = toISODate(row["Fecha de recepción"]);

    return {
      orderNo,
      businessKey: computeLineHash([orderNo, model.normalized ?? model.raw, version, color]),
      lineHash: computeLineHash([orderNo, orderDate, model.raw, version, color, units, eta, status, receivedAt]),
      orderDate,
      modelNameRaw: model.raw,
      modelName: model.normalized,
      version,
      color,
      units,
      eta,
      status,
      receivedAt,
    };
  });

  // --- Comunicados (bulletins) ---
  const bulletins: NormalizedBulletin[] = sheetRows(workbook, "Comunicados").map((row) => ({
    date: toISODate(row["Fecha"]),
    issuer: toText(row["Emisor"]),
    subject: toText(row["Asunto"]),
    body: toText(row["Texto"]),
  }));

  // --- Economía por modelo ---
  const economics: NormalizedModelEconomics[] = sheetRows(workbook, "Economía por modelo").map((row) => {
    const model = resolveModel(row["Modelo"]);
    return {
      modelNameRaw: model.raw,
      modelName: model.normalized,
      avgPrice: toNumber(row["Precio promedio (USD)"]),
      marginPct: toNumber(row["Margen bruto %"]),
      avgUnitCost: toNumber(row["Costo unitario promedio (USD)"]),
      monthlyFinCostPerUnit: toNumber(row["Costo financiero mensual por unidad (USD)"]),
      agingDiscountPolicyRaw: toText(row["Política de descuento por antigüedad"]),
    };
  });

  const modelosDetectados = new Set(
    sales.map((s) => s.modelName).filter((m): m is string => m !== null),
  ).size;

  const stats: ImportStats = {
    modelosDetectados,
    modelosNoMapeados: [...modelosNoMapeados].sort(),
    ventasFilasLeidas: ventasRows.length,
    ventasDuplicadosEliminados: duplicadosEliminados,
    ventasNotasCreditoAplicadas: notasCreditoAplicadas,
    leadsDuplicadosEliminados: leadRows.length - leadRowsById.size,
  };

  return { sales, inventory, leads, factoryOrders, bulletins, economics, stats };
}

export function parseExcelFile(
  filePath: string,
  canonicalModels: readonly string[],
  options: ParseOptions = {},
): NormalizedImport {
  const workbook = XLSX.readFile(filePath);
  return parseWorkbook(workbook, canonicalModels, options);
}
