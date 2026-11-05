import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VersionMixRow } from "@/lib/engine/versionmix";
import { formatInt } from "@/lib/format";

// En el drawer la tabla usa 12 px a los lados y filas de 44 px, con texto de 14 px.
const HEAD = "h-11 px-3";
const CELL = "h-11 px-3";

export function VersionMixTable({ rows, windowMonths }: { rows: VersionMixRow[]; windowMonths: number }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mezcla sugerida por versión</h3>
        <Badge variant="secondary">Propuesta · por confirmar</Badge>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        La fábrica acepta cualquier mezcla dentro del modelo. Reparto proporcional a ventas + leads perdidos por falta de
        stock en los últimos {windowMonths} meses.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={HEAD}>Versión</TableHead>
            <TableHead className={`${HEAD} text-right`}>Ventas {windowMonths} m</TableHead>
            <TableHead className={`${HEAD} text-right`}>Perdidos por stock</TableHead>
            <TableHead className={`${HEAD} text-right`}>En tránsito</TableHead>
            <TableHead className={`${HEAD} text-right`}>Sugerido</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.version}>
              <TableCell className={`${CELL} font-medium`}>{row.version}</TableCell>
              <TableCell className={`${CELL} text-right tabular-nums`}>{formatInt(row.salesInWindow)}</TableCell>
              <TableCell className={`${CELL} text-right tabular-nums`}>{formatInt(row.lostByStockInWindow)}</TableCell>
              <TableCell className={`${CELL} text-right tabular-nums`}>{formatInt(row.inTransit)}</TableCell>
              <TableCell className={`${CELL} text-right tabular-nums`}>
                <strong>{formatInt(row.suggested)}</strong>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
