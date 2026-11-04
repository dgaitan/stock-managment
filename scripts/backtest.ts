import "dotenv/config";
import { writeFileSync } from "node:fs";
import { db } from "@/lib/db/client";
import { loadEngineInputs } from "@/lib/db/loadEngineInputs";
import { computeErrorMetrics, runBacktest, type BacktestRow } from "@/lib/engine/backtest";
import { monthKey } from "@/lib/engine/months";

const pct = (v: number | null) => (v === null ? "n/d" : `${(v * 100).toFixed(0)}%`);
const signedPct = (v: number | null) => (v === null ? "n/d" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`);

interface Summary {
  label: string;
  rows: BacktestRow[];
}

function summarize({ label, rows }: Summary) {
  const vsSales = (pick: (r: BacktestRow) => number) =>
    computeErrorMetrics(rows.map((r) => ({ forecast: pick(r), actual: r.actualSales })));
  const vsCorrected = (pick: (r: BacktestRow) => number) =>
    computeErrorMetrics(rows.map((r) => ({ forecast: pick(r), actual: r.actualCorrected })));
  return {
    label,
    units: rows.reduce((acc, r) => acc + r.actualSales, 0),
    engineSales: vsSales((r) => r.forecast),
    engineCorrected: vsCorrected((r) => r.forecast),
    naiveSales: vsSales((r) => r.naive),
    naiveCorrected: vsCorrected((r) => r.naive),
  };
}

function toMarkdownTable(summaries: ReturnType<typeof summarize>[], firstColumn: string): string {
  const header = [
    `| ${firstColumn} | Ventas reales (u.) | WAPE motor vs ventas | Sesgo motor vs ventas | WAPE motor vs demanda corregida | Sesgo motor vs corregida | WAPE ingenuo vs ventas | WAPE ingenuo vs corregida |`,
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const body = summaries.map(
    (s) =>
      `| ${s.label} | ${s.units} | ${pct(s.engineSales.wape)} | ${signedPct(s.engineSales.bias)} | ` +
      `${pct(s.engineCorrected.wape)} | ${signedPct(s.engineCorrected.bias)} | ` +
      `${pct(s.naiveSales.wape)} | ${pct(s.naiveCorrected.wape)} |`,
  );
  return [...header, ...body].join("\n");
}

async function main() {
  const { config, data, cycle, models, economicsByModel } = await loadEngineInputs(db);

  const rows = runBacktest({
    config,
    models,
    data,
    economicsByModel,
    dataEndMonth: monthKey(cycle.cutoffDate),
  });

  const byModel = models.map((m) =>
    summarize({ label: m.name, rows: rows.filter((r) => r.modelName === m.name) }),
  );
  const byCutoff = config.backtest_cutoffs.map((c) =>
    summarize({
      label: `${c}${rows.some((r) => r.cutoff === c && r.partial) ? " (parcial)" : ""}`,
      rows: rows.filter((r) => r.cutoff === c),
    }),
  );
  const overall = summarize({ label: "**Todos**", rows });
  const partialNotes = config.backtest_cutoffs.flatMap((cutoff) => {
    const partial = rows.find((r) => r.cutoff === cutoff && r.partial);
    return partial
      ? [`- El corte ${cutoff} es **parcial**: su ventana solo tiene datos de ${partial.months.join(", ")}.`]
      : [];
  });

  const markdown = [
    "# Backtest del pronóstico",
    "",
    `Generado con \`bun run backtest\` sobre la base de datos (datos hasta ${cycle.cutoffDate}).`,
    "",
    "Para cada corte (" + config.backtest_cutoffs.join(", ") + ") el motor usa **solo datos anteriores al corte** y pronostica",
    `la ventana de cobertura que cubriría el pedido de ese corte (los meses entre la llegada del pedido y la llegada del pedido de la ventana siguiente, con lead time de ${config.lead_time_months} meses). Se compara contra lo que pasó realmente.`,
    "",
    "- **WAPE** = Σ|pronóstico − real| / Σ real. Menor es mejor. **Sesgo** = (Σ pronóstico − Σ real) / Σ real; negativo = sub-pronóstico.",
    "- **Ventas reales**: ventas netas sin flotas extraordinarias. Están recortadas cuando hubo quiebre de stock.",
    "- **Demanda corregida real**: ventas + leads perdidos por falta de stock × tasa de cierre + sustitución (sin imputar quiebres).",
    "- **Ingenuo**: promedio mensual de ventas de los 12 meses previos al corte, sin ninguna corrección. Si el motor no lo supera, no aporta.",
    ...partialNotes,
    "",
    "## Por modelo (todos los cortes)",
    "",
    toMarkdownTable([...byModel, overall], "Modelo"),
    "",
    "## Por corte (todos los modelos)",
    "",
    toMarkdownTable(byCutoff, "Corte"),
    "",
  ].join("\n");

  console.log(markdown);
  writeFileSync("docs/BACKTEST.md", markdown);
  console.log("\nEscrito en docs/BACKTEST.md");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
