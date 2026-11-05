import { parseNarrative } from "@/lib/orders/narrativeText";

/** Análisis redactado por la IA (primer bloque) y sus alertas. */
export function RunNarrative({ narrative }: { narrative: string }) {
  const { analysis, alerts } = parseNarrative(narrative);
  return (
    <div className="flex flex-col gap-1.5 text-sm leading-[1.6]">
      <p>{analysis}</p>
      {alerts.length > 0 ? (
        <ul className="list-disc pl-5 text-muted-foreground">
          {alerts.map((alert) => (
            <li key={alert}>{alert}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
