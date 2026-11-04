import { loadCycleConfig } from "@/lib/engine/config";
import { explainOrder } from "@/lib/engine/explain";
import { computeModelOrderPlan, type ModelEconomics } from "@/lib/engine/order";
import { parseExcelFile } from "@/lib/sources/excel";
import type { NormalizedModelEconomics } from "@/lib/sources/types";

function toModelEconomics(raw: NormalizedModelEconomics | undefined): ModelEconomics {
  return {
    unitCost: raw?.avgUnitCost ?? 0,
    marginPct: raw?.marginPct ?? 0,
    monthlyFinCost: raw?.monthlyFinCostPerUnit ?? 0,
  };
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("es-NI")}`;
}

function main() {
  const filePath = process.argv[2] ?? "data/seed/caso1.xlsx";
  const config = loadCycleConfig();
  const canonicalModels = config.models.map((m) => m.name);

  const parsed = parseExcelFile(filePath, canonicalModels, {
    fleetOutlierMinUnits: config.fleet_outlier_min_units,
  });
  const economicsByModel = new Map(
    parsed.economics.filter((e) => e.modelName).map((e) => [e.modelName as string, e]),
  );

  const plans = config.models.map((model) =>
    computeModelOrderPlan({
      config,
      model,
      economics: toModelEconomics(economicsByModel.get(model.name)),
      sales: parsed.sales,
      leads: parsed.leads,
      inventory: parsed.inventory,
      factoryOrders: parsed.factoryOrders,
    }),
  );

  console.log(`--- Pedido sugerido (corte ${config.cutoff_date}, ventana cierra ${config.order_window_closes}) ---`);
  console.table(
    plans.map((p) => ({
      Modelo: p.modelName,
      "Demanda u/mes": p.forecastMonthlyRate.toFixed(1),
      "Stock proy. feb": p.projectedStockFeb.toFixed(1),
      Necesidad: p.need.toFixed(1),
      Pedido: p.orderUnits,
      Capital: formatMoney(p.capital),
      "Cobertura (meses)": p.coverageMonthsAchieved.toFixed(1),
      Colchón: p.safetyTier,
    })),
  );

  const totalCapital = plans.reduce((acc, p) => acc + p.capital, 0);
  const totalUnits = plans.reduce((acc, p) => acc + p.orderUnits, 0);
  console.log(`\nTotal pedido: ${totalUnits} unidades, capital comprometido ${formatMoney(totalCapital)}`);

  if (parsed.stats.modelosNoMapeados.length > 0) {
    console.log(`\nAlerta: modelos sin mapear en el Excel -> ${parsed.stats.modelosNoMapeados.join(", ")}`);
  }

  console.log("\n--- Por qué (por modelo) ---");
  for (const plan of plans) {
    console.log(`\n[${plan.modelName}]`);
    console.log(explainOrder(plan));
  }
}

main();
