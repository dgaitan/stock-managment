import { ruleKeyLabel, ruleValueLabel } from "@/lib/bulletins/labels";
import type { RulesPreview } from "@/lib/bulletins/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Vista previa de lo que la IA extrajo: qué se guardaría y qué quedó fuera (y por qué). */
export function RulesPreviewList({ preview }: { preview: RulesPreview }) {
  return (
    <div className="flex flex-col gap-3">
      {preview.rules.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Regla</TableHead>
              <TableHead className="text-right">Nuevo</TableHead>
              <TableHead className="text-right">Hoy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rules.map((rule) => (
              <TableRow key={`${rule.model}-${rule.key}`}>
                <TableCell className="font-medium">{rule.model}</TableCell>
                <TableCell>{ruleKeyLabel(rule.key)}</TableCell>
                <TableCell className="text-right">{ruleValueLabel(rule.key, rule.value)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {rule.current === null
                    ? "—"
                    : rule.current === rule.value
                      ? "igual"
                      : ruleValueLabel(rule.key, rule.current)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">La IA no encontró reglas que el motor pueda aplicar.</p>
      )}
      {preview.notExtracted.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">No se aplica (el motor no lo entiende)</p>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {preview.notExtracted.map((item) => (
              <li key={`${item.text}-${item.reason}`}>
                «{item.text}» — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
