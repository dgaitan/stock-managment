import { NarrativeDialog } from "@/components/molecules/narrative-dialog";
import { ReasonCell } from "@/components/molecules/reason-cell";
import { DeltaBadge } from "@/components/molecules/delta-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt, formatTimestamp, formatUsd, formatUsdMillions } from "@/lib/format";
import type { ReactNode } from "react";
import { lineChanged } from "@/lib/orders/runSummary";
import type { OrderLineView, OrderRunView } from "@/lib/orders/types";

type OrderTableProps = {
  run: OrderRunView | null;
  calculateAction: ReactNode;
  renderWhy: (line: OrderLineView) => ReactNode;
};

export function OrderTable({ run, calculateAction, renderWhy }: OrderTableProps) {
  const previousTotal = run && run.lines.some((l) => l.previousOrderUnits !== null)
    ? run.lines.reduce((acc, l) => acc + (l.previousOrderUnits ?? 0), 0)
    : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h2 className="text-base font-semibold">Pedido sugerido</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {run ? (
              <>
                <b className="font-semibold text-foreground">
                  {formatInt(run.totalUnits)} unidades · {formatUsdMillions(run.totalCapital)}
                </b>{" "}
                · Análisis v{run.version} · {formatTimestamp(run.createdAt)} · {run.rulesSummary}
                {run.narrative ? (
                  <>
                    {" "}
                    · <NarrativeDialog narrative={run.narrative} />
                  </>
                ) : null}
              </>
            ) : (
              "Sin análisis todavía"
            )}
          </p>
        </div>
        {calculateAction}
      </div>
      {run ? (
        <div className="border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Capital (USD)</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.lines.map((line) => (
                <TableRow key={line.modelId} className={lineChanged(line) ? "bg-info-surface" : undefined}>
                  <TableCell className="font-medium">{line.modelName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <strong className={line.orderUnits === 0 ? "text-base text-muted-foreground" : "text-base"}>
                        {formatInt(line.orderUnits)}
                      </strong>
                      <DeltaBadge current={line.orderUnits} previous={line.previousOrderUnits} />
                    </span>
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${line.orderUnits === 0 ? "text-muted-foreground" : ""}`}>
                    {line.orderUnits === 0 ? "—" : formatUsd(line.capital)}
                  </TableCell>
                  <TableCell>
                    <ReasonCell reason={line.detail.reason} demandFactor={line.demandFactor} />
                  </TableCell>
                  <TableCell className="text-right">{renderWhy(line)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-subtle">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    {formatInt(run.totalUnits)}
                    <DeltaBadge current={run.totalUnits} previous={previousTotal} />
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatUsd(run.totalCapital)}</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : null}
    </Card>
  );
}
