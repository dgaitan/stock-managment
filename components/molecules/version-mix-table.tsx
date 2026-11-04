import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VersionMixRow } from "@/lib/engine/versionmix";
import { formatInt } from "@/lib/format";

export function VersionMixTable({ rows, windowLabel }: { rows: VersionMixRow[]; windowLabel: string }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mezcla sugerida por versión</h3>
        <Badge variant="secondary">Propuesta · por confirmar</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        La fábrica acepta cualquier mezcla dentro del modelo. Reparto proporcional a ventas y leads perdidos por falta
        de stock en {windowLabel}.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Versión</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Perdidos por stock</TableHead>
            <TableHead className="text-right">En tránsito</TableHead>
            <TableHead className="text-right">Sugerido</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.version}>
              <TableCell className="font-medium">{row.version}</TableCell>
              <TableCell className="text-right tabular-nums">{formatInt(row.salesInWindow)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatInt(row.lostByStockInWindow)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatInt(row.inTransit)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatInt(row.suggested)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
