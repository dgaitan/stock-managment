import { ReasonCell } from "@/components/molecules/reason-cell";
import { DeltaBadge } from "@/components/molecules/delta-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInt, formatTimestamp, formatUsd, formatUsdMillions } from "@/lib/format";
import type { ReactNode } from "react";
import type { OrderLineView, OrderRunView } from "@/lib/orders/types";

type OrderTableProps = {
  run: OrderRunView | null;
  calculateAction: ReactNode;
  renderWhy: (line: OrderLineView) => ReactNode;
};

export function OrderTable({ run, calculateAction, renderWhy }: OrderTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Pedido sugerido</CardTitle>
          <p className="text-sm text-muted-foreground">
            {run ? (
              <>
                <b className="font-semibold text-foreground">
                  {formatInt(run.totalUnits)} unidades · {formatUsdMillions(run.totalCapital)}
                </b>{" "}
                · Análisis v{run.version} · {formatTimestamp(run.createdAt)}
              </>
            ) : (
              "Aún no hay un análisis. Calcula el primero con los datos importados."
            )}
          </p>
        </div>
        {calculateAction}
      </CardHeader>
      {run ? (
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Modelo</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Capital (USD)</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="pr-6">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.lines.map((line) => (
                <TableRow key={line.modelId}>
                  <TableCell className="pl-6 font-medium">{line.modelName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="flex items-baseline justify-end gap-2">
                      <DeltaBadge current={line.orderUnits} previous={line.previousOrderUnits} />
                      <strong className={line.orderUnits === 0 ? "text-base text-muted-foreground" : "text-base"}>
                        {formatInt(line.orderUnits)}
                      </strong>
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.orderUnits === 0 ? "—" : formatUsd(line.capital)}
                  </TableCell>
                  <TableCell>
                    <ReasonCell reason={line.detail.reason} />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {renderWhy(line)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-6 font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatInt(run.totalUnits)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatUsd(run.totalCapital)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      ) : null}
    </Card>
  );
}
