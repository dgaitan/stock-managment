import { explainOrder } from "@/lib/engine/explain";
import { computeModelOrderPlan } from "@/lib/engine/order";
import { loadCaseContext } from "./caseContext";

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("es-NI")}`;
}

function main() {
  const filePath = process.argv[2] ?? "data/seed/caso1.xlsx";
  const { config, parsed, cycle, models, economicsByModel } = loadCaseContext(filePath);
  const zero = { unitCost: 0, marginPct: 0, monthlyFinCost: 0 };

  const plans = models.map((model) =>
    computeModelOrderPlan({
      config,
      cycle,
      model,
      economics: economicsByModel.get(model.name) ?? zero,
      sales: parsed.sales,
      leads: parsed.leads,
      inventory: parsed.inventory,
      factoryOrders: parsed.factoryOrders,
    }),
  );

  console.log(
    `--- Pedido sugerido (corte ${cycle.cutoffDate}, ventana ${cycle.window} cierra ${cycle.windowCloses}, llega ${cycle.arrivalMonth}) ---`,
  );
  console.table(
    plans.map((p) => ({
      Modelo: p.modelName,
      "Demanda u/mes": p.forecastMonthlyRate.toFixed(1),
      [`Stock proy. ${cycle.arrivalMonth}`]: p.projectedStockAtArrival.toFixed(1),
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
