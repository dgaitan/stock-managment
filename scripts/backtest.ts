import { writeFileSync } from "node:fs";
import { computeErrorMetrics, runBacktest, type BacktestRow } from "@/lib/engine/backtest";
import { loadCycleConfig } from "@/lib/engine/config";
import { monthKey } from "@/lib/engine/months";
import type { ModelEconomics } from "@/lib/engine/order";
import { parseExcelFile } from "@/lib/sources/excel";

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

function main() {
  const filePath = process.argv[2] ?? "data/seed/caso1.xlsx";
  const config = loadCycleConfig();
  const parsed = parseExcelFile(
    filePath,
    config.models.map((m) => m.name),
    { fleetOutlierMinUnits: config.fleet_outlier_min_units },
  );

  const economicsByModel = new Map<string, ModelEconomics>();
  for (const e of parsed.economics) {
    if (!e.modelName) continue;
    economicsByModel.set(e.modelName, {
      unitCost: e.avgUnitCost ?? 0,
      marginPct: e.marginPct ?? 0,
      monthlyFinCost: e.monthlyFinCostPerUnit ?? 0,
    });
  }

  const rows = runBacktest({
    config,
    data: parsed,
    economicsByModel,
    dataEndMonth: monthKey(config.cutoff_date),
  });

  const byModel = config.models.map((m) =>
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
    `Generado con \`bun run backtest\` sobre \`${filePath}\` (datos hasta ${config.cutoff_date}).`,
    "",
    "Para cada corte (" + config.backtest_cutoffs.join(", ") + ") el motor usa **solo datos anteriores al corte** y pronostica",
    `la ventana de cobertura que cubriría el pedido de ese corte (meses +${config.lead_time_months + 1} a +${config.lead_time_months + config.order_coverage_months}). Se compara contra lo que pasó realmente.`,
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

main();
