# Pedido Inteligente — Casa Pellas (Caso 1)

Sistema que calcula el pedido trimestral a fábrica por modelo Toyota a partir
de ventas, inventario, leads y comunicados. Contexto completo y supuestos en
[`docs/PLAN.md`](docs/PLAN.md); reglas para trabajar en el repo en
[`CLAUDE.md`](CLAUDE.md).

Datos del caso son ficticios y **no se publican** (repo privado / entrega en zip).

## Stack

Next.js (App Router) + TypeScript · shadcn/ui + Tailwind · Postgres (Drizzle)
· Vitest. Local: Postgres instalado en la máquina (sin Docker). Producción:
Vercel + Neon.

## Correr en local

Requiere Postgres corriendo en `localhost:5432` (p. ej. [Postgres.app](https://postgresapp.com)).

```bash
bun install
createdb pedido_inteligente    # una vez, si la base no existe
cp .env.example .env           # completar DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD
bun run db:migrate
bun run seed                   # carga data/seed/caso1.xlsx (no versionado)
bun run dev                    # http://localhost:3000
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `bun run dev` | Servidor de desarrollo |
| `bun test` | Vitest — motor y limpieza |
| `bun run db:generate` / `db:migrate` | Migraciones Drizzle |
| `bun run seed` | Importa el Excel del caso a la base |
| `bun run pedido -- <xlsx>` | CLI: imprime la tabla de pedido por modelo sin UI |

## Despliegue (Vercel + Neon)

1. Crear un proyecto Postgres en [Neon](https://neon.tech) y copiar el
   connection string **pooled**.
2. En Vercel, configurar `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   `SESSION_SECRET` (y `ANTHROPIC_API_KEY` si se quiere IA) como variables de
   entorno del proyecto — nunca en el repo.
3. `bun run db:migrate` contra el `DATABASE_URL` de Neon antes del primer deploy.
4. Conectar el repo en Vercel y desplegar.

## Estructura

Ver `docs/PLAN.md` § "Estructura del repositorio". El motor (`lib/engine`) es
TypeScript puro y corre igual desde la UI o desde `scripts/pedido.ts` por CLI.
