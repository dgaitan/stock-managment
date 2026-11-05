import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInt } from "@/lib/format";
import type { ImportDiff } from "@/lib/import/diff";
import { SHEET_LABELS } from "@/lib/import/labels";

// `updates` / `deletes`: si la hoja puede actualizar o eliminar filas. Los comunicados
// solo se agregan y la economía nunca borra un modelo: esas celdas muestran «—».
const SHEETS: { key: keyof ImportDiff; updates: boolean; deletes: boolean }[] = [
  { key: "sales", updates: true, deletes: true },
  { key: "inventory", updates: true, deletes: true },
  { key: "leads", updates: true, deletes: true },
  { key: "factoryOrders", updates: true, deletes: true },
  { key: "economics", updates: true, deletes: false },
  { key: "bulletins", updates: false, deletes: false },
];

const countText = (applies: boolean, value: number) => (applies ? formatInt(value) : "—");

export function ImportDiffTable({ diff }: { diff: ImportDiff }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Qué cambia en la base</h3>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table size="sm">
          <TableHeader>
            <TableRow>
              <TableHead>Hoja</TableHead>
              <TableHead className="text-right">Nuevas</TableHead>
              <TableHead className="text-right">Actualizadas</TableHead>
              <TableHead className="text-right">Se eliminan</TableHead>
              <TableHead className="text-right">Sin cambios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SHEETS.map(({ key, updates, deletes }) => (
              <TableRow key={key}>
                <TableCell className="font-medium">{SHEET_LABELS[key]}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInt(diff[key].inserted)}</TableCell>
                <TableCell className="text-right tabular-nums">{countText(updates, diff[key].updated)}</TableCell>
                <TableCell className={`text-right tabular-nums ${diff[key].deleted > 0 ? "font-medium text-destructive" : ""}`}>
                  {countText(deletes, diff[key].deleted)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{formatInt(diff[key].unchanged)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
