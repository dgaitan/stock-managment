import { InfoTip } from "@/components/molecules/info-tip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt } from "@/lib/format";
import type { ImportDiff } from "@/lib/import/diff";

const SHEETS: { key: keyof ImportDiff; label: string; hasUpdates?: false }[] = [
  { key: "sales", label: "Ventas" },
  { key: "inventory", label: "Inventario" },
  { key: "leads", label: "Leads" },
  { key: "factoryOrders", label: "Pedidos a fábrica" },
  { key: "economics", label: "Economía por modelo" },
  { key: "bulletins", label: "Comunicados", hasUpdates: false },
];

const cell = (value: number) => (value === 0 ? "text-muted-foreground" : "font-medium");

export function ImportDiffTable({ diff }: { diff: ImportDiff }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1 text-sm font-semibold">
        Qué cambia en la base
        <InfoTip label="Cómo se comparan las filas">
          Cada fila se identifica por su clave de negocio. Si un lead cambia de resultado o un pedido de ETA o estado, se
          actualiza; nunca se duplica. El inventario se reemplaza solo en los meses que trae el archivo.
        </InfoTip>
      </h3>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-3">Hoja</TableHead>
              <TableHead className="text-right">Nuevas</TableHead>
              <TableHead className="text-right">Actualizadas</TableHead>
              <TableHead className="pr-3 text-right">Sin cambios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SHEETS.map(({ key, label, hasUpdates }) => (
              <TableRow key={key}>
                <TableCell className="pl-3 font-medium">{label}</TableCell>
                <TableCell className={`text-right tabular-nums ${cell(diff[key].inserted)}`}>{formatInt(diff[key].inserted)}</TableCell>
                <TableCell className={`text-right tabular-nums ${cell(diff[key].updated)}`}>
                  {hasUpdates === false ? "—" : formatInt(diff[key].updated)}
                </TableCell>
                <TableCell className="pr-3 text-right text-muted-foreground tabular-nums">{formatInt(diff[key].unchanged)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
