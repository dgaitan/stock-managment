/** Análisis redactado por la IA (primer bloque) y sus alertas (líneas que empiezan con «- »). */
export function RunNarrative({ narrative }: { narrative: string }) {
  const lines = narrative.split("\n").filter((l) => l.trim() !== "");
  const alerts = lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  const analysis = lines.filter((l) => !l.startsWith("- ")).join(" ");
  return (
    <div className="flex flex-col gap-1.5 text-sm">
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
