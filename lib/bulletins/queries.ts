import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import type { BulletinView } from "@/lib/bulletins/types";

/** Comunicados (vigentes primero, luego archivados) con las reglas que originaron. */
export async function listBulletins(): Promise<BulletinView[]> {
  const [bulletins, rules] = await Promise.all([
    db.select().from(schema.bulletins).orderBy(desc(schema.bulletins.date), desc(schema.bulletins.id)),
    db
      .select({
        bulletinId: schema.cycleRules.bulletinId,
        model: schema.models.name,
        key: schema.cycleRules.key,
        value: schema.cycleRules.value,
      })
      .from(schema.cycleRules)
      .innerJoin(schema.models, eq(schema.models.id, schema.cycleRules.modelId))
      .orderBy(asc(schema.models.name), asc(schema.cycleRules.key)),
  ]);

  const views = bulletins.map<BulletinView>((b) => ({
    id: b.id,
    date: b.date,
    issuer: b.issuer,
    subject: b.subject,
    body: b.body ?? "",
    source: b.source,
    scope: b.scope,
    cycle: b.cycle,
    archived: b.archivedAt !== null,
    rules: rules.filter((r) => r.bulletinId === b.id).map(({ model, key, value }) => ({ model, key, value })),
  }));
  return [...views.filter((b) => !b.archived), ...views.filter((b) => b.archived)];
}
