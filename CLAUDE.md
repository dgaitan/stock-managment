# Pedido Inteligente — Prueba técnica Casa Pellas (Caso 1)

Lee `docs/PLAN.md` antes de cualquier cambio. Datos ficticios: no publicar.
Entrega: jueves 5 de noviembre de 2026, 6:00 p.m.

## Reglas

- El motor (`lib/engine`) es TypeScript puro: sin imports de Next, React ni DB.
  Recibe datos normalizados y devuelve resultados. Todo parámetro sale de
  `config/cycle.yaml` (cargado vía `lib/engine/config.ts`), nunca hardcodeado.
- La IA nunca decide cantidades. Solo sugiere mapeos de alias que el usuario
  confirma (`lib/ai/mapper.ts`). El cálculo del pedido es 100% determinístico.
- La app debe funcionar sin `ANTHROPIC_API_KEY` (solo se pierden las sugerencias
  automáticas de alias).
- Ningún secreto en el código. Usa `.env` (ignorado) y `.env.example`.
- Cada regla de negocio nueva lleva un test en `tests/`.
- UI: shadcn/ui, textos en español, una sola página (SPA) con drawers (`Sheet`).
- **Base de datos: Postgres, no SQLite.** El plan original (`docs/PLAN.md`)
  asumía SQLite + Docker/VPS; se cambió a Vercel, así que la persistencia es
  Postgres instalado localmente (sin Docker — Postgres.app en :5432) para dev,
  y **Neon** en producción. Un solo driver (`postgres-js`, ver
  `lib/db/client.ts`) habla el protocolo estándar de Postgres contra ambos —
  solo cambia `DATABASE_URL` por entorno. No reintroducir `better-sqlite3` ni
  Docker.
- Migraciones con `drizzle-kit` (`bun run db:generate` / `db:migrate`), nunca
  `CREATE TABLE` a mano.
- Idempotencia de importación por `line_hash` — reimportar el mismo Excel no
  duplica filas en `sales` / `factory_orders`.

## Comandos

- `bun run dev` — servidor de desarrollo
- `bun test` — Vitest (motor y limpieza)
- `bun run db:generate` / `bun run db:migrate` — migraciones Drizzle
- `bun run seed` — carga `data/seed/caso1.xlsx` a la base
- `bun run pedido -- <xlsx>` — CLI que imprime la tabla de pedido por modelo

## Despliegue

Vercel + Neon. Variables de entorno (`DATABASE_URL`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `SESSION_SECRET`, `ANTHROPIC_API_KEY` opcional) se configuran
en el proyecto de Vercel, nunca en el repo. `DATABASE_URL` de Neon debe ser el
connection string "pooled" (las funciones serverless de Vercel abren muchas
conexiones cortas).

## Fases

Ver `docs/PLAN.md` § "Plan de trabajo por fases". No avanzar a la fase
siguiente sin que el usuario revise el reporte/criterio de la fase actual.
