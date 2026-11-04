import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-5-5";

/** Sin ANTHROPIC_API_KEY la IA está apagada y la app funciona con las reglas guardadas. */
export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function aiModel(): string {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

/** Cliente de Anthropic, o null si no hay API key. */
export function getAiClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}
