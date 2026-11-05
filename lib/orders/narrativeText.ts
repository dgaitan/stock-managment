// Lectura de la narrativa guardada (formato de lib/ai/narrative.ts): primer bloque = análisis,
// líneas con «- » = alertas. Puro, lo usan el diálogo de la lectura y el drawer «Ver por qué».

export function parseNarrative(narrative: string): { analysis: string; alerts: string[] } {
  const lines = narrative.split("\n").filter((l) => l.trim() !== "");
  return {
    analysis: lines.filter((l) => !l.startsWith("- ")).join(" "),
    alerts: lines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2)),
  };
}

/**
 * Alertas de la narrativa que nombran al modelo (sin distinguir mayúsculas). Las menciones de un modelo
 * de nombre más largo que lo contiene (p. ej. «Yaris Cross» para «Yaris») no cuentan.
 */
export function alertsForModel(narrative: string | null, modelName: string, allModels: string[]): string[] {
  if (!narrative) return [];
  const name = modelName.toLowerCase();
  const longer = allModels.map((m) => m.toLowerCase()).filter((m) => m !== name && m.includes(name));
  return parseNarrative(narrative).alerts.filter((alert) => {
    const text = longer.reduce((acc, m) => acc.replaceAll(m, ""), alert.toLowerCase());
    return text.includes(name);
  });
}
