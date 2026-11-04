import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseWorkbook } from "@/lib/sources/excel";

const CANONICAL_MODELS = ["Hilux", "Corolla Cross", "Yaris"];

function buildWorkbook() {
  const wb = XLSX.utils.book_new();

  const ventas = XLSX.utils.aoa_to_sheet([
    [
      "Fecha",
      "Factura",
      "Sucursal",
      "Vendedor",
      "Tipo de cliente",
      "Cliente",
      "Modelo",
      "Versión",
      "Color",
      "Unidades",
      "Precio unitario (USD)",
      "Nota",
    ],
    [45200, "FAC-1", "Managua", "Ana", "Individual", "Juan Pérez", "Toyota Hilux", "4x4", "Blanco", 1, 40000, ""],
    // fila duplicada exacta de la anterior: debe deduplicarse por line_hash
    [45200, "FAC-1", "Managua", "Ana", "Individual", "Juan Pérez", "Toyota Hilux", "4x4", "Blanco", 1, 40000, ""],
    [45201, "FAC-2", "León", "Luis", "Individual", "María Gómez", "corolla  cross", "SEG", "Negro", 1, 30000, ""],
    [
      45202,
      "NC-1",
      "Managua",
      "Ana",
      "Individual",
      "Juan Pérez",
      "HILUX",
      "4x4",
      "Blanco",
      -1,
      40000,
      "Devolución ref. FAC-1",
    ],
    [45203, "FAC-3", "Managua", "Carla", "Flota / Institucional", "Gobierno", "Yaris ", "SEG", "Rojo", 15, 20000, ""],
    [45204, "FAC-4", "Managua", "Carla", "Flota / Institucional", "Gobierno", "Yaris", "SEG", "Rojo", 2, 20000, ""],
    [45205, "FAC-5", "Managua", "Carla", "Individual", "Pedro", "Toyota Supra", "Base", "Rojo", 1, 50000, ""],
  ]);
  XLSX.utils.book_append_sheet(wb, ventas, "Ventas");

  const inventario = XLSX.utils.aoa_to_sheet([
    ["Mes (cierre)", "Modelo", "Versión", "Color", "Unidades", "Antigüedad promedio (días)"],
    [45230, "Hilux", "4x4", "Blanco", 3, 61],
  ]);
  XLSX.utils.book_append_sheet(wb, inventario, "Inventario");

  const leads = XLSX.utils.aoa_to_sheet([
    [
      "ID Oportunidad",
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
    ],
    [
      "OPP-1",
      45196,
      45200,
      "Managua",
      "Ana",
      "Individual",
      "Corolla Cross",
      "SEG",
      1,
      "Perdida",
      "No hay unidades disponibles",
      "",
      "",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, leads, "Leads");

  const pedidos = XLSX.utils.aoa_to_sheet([
    [
      "No. pedido",
      "Fecha pedido",
      "Modelo",
      "Versión",
      "Color",
      "Unidades",
      "Fecha estimada de llegada",
      "Estado",
      "Fecha de recepción",
    ],
    ["PF-1", 45100, "Hilux", "4x4", "Blanco", 5, 45200, "Recibido", 45201],
  ]);
  XLSX.utils.book_append_sheet(wb, pedidos, "Pedidos");

  const economia = XLSX.utils.aoa_to_sheet([
    [
      "Modelo",
      "Precio promedio (USD)",
      "Margen bruto %",
      "Costo unitario promedio (USD)",
      "Costo financiero mensual por unidad (USD)",
      "Política de descuento por antigüedad",
    ],
    ["Hilux", 43700, 0.13, 38020, 342, "Más de 180 días: 4%"],
  ]);
  XLSX.utils.book_append_sheet(wb, economia, "Economía por modelo");

  const comunicados = XLSX.utils.aoa_to_sheet([
    ["Fecha", "Emisor", "Asunto", "Texto"],
    [45334, "Fábrica", "Calendario", "Texto del comunicado"],
  ]);
  XLSX.utils.book_append_sheet(wb, comunicados, "Comunicados");

  return wb;
}

describe("parseWorkbook", () => {
  const wb = buildWorkbook();
  const result = parseWorkbook(wb, CANONICAL_MODELS, { fleetOutlierMinUnits: 10 });

  it("deduplica filas de venta idénticas por line_hash", () => {
    expect(result.sales).toHaveLength(6);
    expect(result.stats.ventasFilasLeidas).toBe(7);
    expect(result.stats.ventasDuplicadosEliminados).toBe(1);
  });

  it("normaliza nombres de modelo con distintas variantes", () => {
    const hilux = result.sales.find((s) => s.invoice === "FAC-1");
    const corollaCross = result.sales.find((s) => s.invoice === "FAC-2");
    expect(hilux?.modelName).toBe("Hilux");
    expect(corollaCross?.modelName).toBe("Corolla Cross");
  });

  it("marca modelos sin mapear como alerta de calidad", () => {
    expect(result.stats.modelosNoMapeados).toEqual(["Toyota Supra"]);
    const supra = result.sales.find((s) => s.invoice === "FAC-5");
    expect(supra?.modelName).toBeNull();
  });

  it("marca notas de crédito", () => {
    expect(result.stats.ventasNotasCreditoAplicadas).toBe(1);
    const nc = result.sales.find((s) => s.invoice === "NC-1");
    expect(nc?.isCreditNote).toBe(true);
    expect(nc?.units).toBe(-1);
  });

  it("marca como atípica solo la línea de flota con >= 10 unidades", () => {
    const flotaGrande = result.sales.find((s) => s.invoice === "FAC-3");
    const flotaChica = result.sales.find((s) => s.invoice === "FAC-4");
    expect(flotaGrande?.isFleetOutlier).toBe(true);
    expect(flotaChica?.isFleetOutlier).toBe(false);
  });

  it("parsea inventario, leads, pedidos, comunicados y economía", () => {
    expect(result.inventory).toHaveLength(1);
    expect(result.inventory[0].modelName).toBe("Hilux");
    expect(result.inventory[0].monthEnd).toBe("2023-10-31");

    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].lossReasonCategory).toBe("stock");
    expect(result.leads[0].modelName).toBe("Corolla Cross");

    expect(result.factoryOrders).toHaveLength(1);
    expect(result.factoryOrders[0].modelName).toBe("Hilux");
    expect(result.factoryOrders[0].status).toBe("Recibido");

    expect(result.bulletins).toHaveLength(1);
    expect(result.bulletins[0].issuer).toBe("Fábrica");

    expect(result.economics).toHaveLength(1);
    expect(result.economics[0].modelName).toBe("Hilux");
  });

  it("cuenta los modelos detectados en ventas", () => {
    expect(result.stats.modelosDetectados).toBe(3);
  });
});
