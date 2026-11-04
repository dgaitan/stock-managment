// Tipos de lo que lee la UI de comunicados. Sin imports de servidor.
import type { ExtractedRule } from "@/lib/ai/ruleExtraction";
import type { NotApplied } from "@/lib/ai/considerations";

export interface BulletinView {
  id: number;
  date: string;
  issuer: string | null;
  subject: string;
  body: string;
  source: "excel" | "user";
  scope: "permanent" | "cycle";
  cycle: string | null;
  archived: boolean;
  rules: ExtractedRule[];
}

export interface RulePreviewItem extends ExtractedRule {
  current: string | null; // valor que hoy tiene la regla vigente (de otro origen o de este), si existe
}

export interface RulesPreview {
  rules: RulePreviewItem[];
  notExtracted: NotApplied[];
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export type BulletinDraft = {
  id: number | null;
  date: string;
  issuer: string;
  subject: string;
  body: string;
  scope: "permanent" | "cycle";
  cycle: string;
};
