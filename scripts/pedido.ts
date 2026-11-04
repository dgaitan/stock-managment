import "dotenv/config";
import { db } from "@/lib/db/client";
import { loadEngineInputs } from "@/lib/db/loadEngineInputs";
import { explainOrder } from "@/lib/engine/explain";
import { computeModelOrderPlan } from "@/lib/engine/order";

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("es-NI")}`;
}

async function main() {
  const { config, data, cycle, models, economicsByModel } = await loadEngineInputs(db);
  const zero = { unitCost: 0, marginPct: 0, monthlyFinCost: 0 };

  const plans = models.map((model) =>
    computeModelOrderPlan({
      config,
      cycle,
      model,
      economics: economicsByModel.get(model.name) ?? zero,
      ...data,
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

  console.log("\n--- Por qué (por modelo) ---");
  for (const plan of plans) {
    console.log(`\n[${plan.modelName}]`);
    console.log(explainOrder(plan));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
