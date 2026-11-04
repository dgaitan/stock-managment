# Pedido Inteligente — Prueba técnica Casa Pellas (Caso 1)

Lee `docs/PLAN.md` antes de cualquier cambio. Datos ficticios: no publicar.
Entrega: jueves 5 de noviembre de 2026, 6:00 p.m.

## Reglas

- El motor (`lib/engine`) es TypeScript puro: sin imports de Next, React ni DB.
  Recibe datos normalizados y devuelve resultados. Ningún parámetro hardcodeado.
  Lo que cambia por ciclo se **deriva**: corte, ventana, mes de llegada y cobertura
  salen del último cierre de inventario (`lib/engine/cycle.ts`); lotes y regla RAV4
  salen de las reglas vigentes (`lib/engine/rules.ts`, tabla `cycle_rules`, con
  vigencia `permanent` o por ventana). `config/cycle.yaml` queda solo con supuestos
  de pronóstico (pesos, z, umbrales, `window_months`). El motor lee todo de la base con un solo cargador
  (`lib/db/loadEngineInputs.ts`, usado por la CLI y la app); `config/cycle_rules.yaml`
  es solo la semilla de `cycle_rules`. No agregar
  fechas ni meses fijos («febrero», «2026-10») en código nuevo.
- La IA nunca decide ni escribe cantidades. Puede (a) sugerir alias que el usuario
  confirma (`lib/ai/mapper.ts`), (b) extraer reglas de los comunicados y traducir
  las consideraciones del usuario a **parámetros acotados validados con zod**
  (`lib/ai/rules.ts`), siempre con vista previa y confirmación, y (c) redactar el
  análisis y el «por qué». El cálculo del pedido es 100% determinístico; una
  regla que el motor no entiende se marca «no aplicada», nunca se ignora en
  silencio. Ver `docs/PLAN.md` § «Flujo con IA».
- La app debe funcionar sin `ANTHROPIC_API_KEY` (solo se pierden las sugerencias
  de alias, la extracción de reglas, la caja de consideraciones y la narrativa).
- Ningún secreto en el código. Usa `.env` (ignorado) y `.env.example`.
- Cada regla de negocio nueva lleva un test en `tests/`.
- **Mensajes de commit en inglés** (asunto en imperativo, p. ej.
  `Add order table organism`), aunque el código y la UI estén en español.
- UI: shadcn/ui, textos en español, una sola página (SPA) con drawers (`Sheet`).
  Diseño aprobado (Claude Design, «Pedido a fábrica — Dashboard (Caso 1)»): el
  dashboard responde solo «¿cuánto pedir de cada modelo?» — tabla de 4 columnas
  (modelo, pedido, capital, motivo), sin KPIs ni gráfica; el detalle va en «Ver
  por qué». «Calcular pedido» es un stepper de 3 pasos (comunicados y reglas →
  reglas adicionales → confirmar). Menos datos en pantalla es mejor. «Nuevo
  registro» queda fuera del MVP.
- **Base de datos: Postgres, no SQLite.** El plan original (`docs/PLAN.md`)
  asumía SQLite + Docker/VPS; se cambió a Vercel, así que la persistencia es
  Postgres instalado localmente (sin Docker — Postgres.app en :5432) para dev,
  y **Neon** en producción. Un solo driver (`postgres-js`, ver
  `lib/db/client.ts`) habla el protocolo estándar de Postgres contra ambos —
  solo cambia `DATABASE_URL` por entorno. No reintroducir `better-sqlite3` ni
  Docker.
- Migraciones con `drizzle-kit` (`bun run db:generate` / `db:migrate`), nunca
  `CREATE TABLE` a mano.
- Reglas del motor ya acordadas (no revertir sin preguntar): el stock proyectado
  se simula mes a mes con las ETA y **nunca baja de 0** (la demanda sin stock se
  pierde, no se suma al pedido); la sustitución suma la demanda al modelo que el
  cliente quería; los meses de quiebre se imputan al promedio de los meses sin
  quiebre. Detalle en `docs/PLAN.md` § «Lógica del motor».
- El pedido es por modelo (lotes de fábrica). La mezcla por versión es una
  sugerencia aparte, pendiente de confirmar; el color no entra al cálculo.
- Importación por **clave de negocio** (`business_key` en ventas y pedidos,
  `external_id` en leads) + `line_hash` del contenido: reimportar el mismo Excel
  no cambia nada; un archivo de otro ciclo inserta lo nuevo y **actualiza** lo que
  cambió (resultado de un lead, ETA o estado de un pedido), nunca duplica. El
  inventario se reemplaza solo en los meses que trae el archivo. Los comunicados
  son un CRUD propio: la importación solo agrega los que no existen (fecha +
  asunto), nunca borra ni sobrescribe. Siempre vista previa antes de escribir
  (`lib/db/importWorkbook.ts`).

## Convenciones de código

Detalle en `.claude/rules/` (se cargan solas según la ruta que se edita):

- `file-size.md` — máximo 300 líneas por archivo (ESLint `max-lines`).
- `atomic-design.md` — `components/ui` (átomos shadcn) → `molecules` →
  `organisms` → `templates`; imports solo hacia abajo.
- `react.md` — Server Components por defecto, hooks en `hooks/`, sin `key`
  por índice; complementa el skill `react-best-practices`.
- `nextjs.md` — checklist de producción de Next 16 (`proxy.ts`, `server-only`,
  sesión verificada en cada acción).
- `dry.md` — una fuente de verdad por conocimiento; regla de tres.

**Al terminar cada tarea**, antes de declararla lista o hacer commit, ejecutar
el agente `best-practices-reviewer` sobre los cambios y corregir toda
violación que reporte. Una tarea con resultado FALLA no está terminada.

## Comandos

- `bun run dev` — servidor de desarrollo
- `bun run test` — Vitest (motor, limpieza e importación). Ojo: `bun test` a
  secas usa el runner de Bun, no Vitest
- `bun run db:generate` / `bun run db:migrate` — migraciones Drizzle
- `bun run seed [-- <xlsx>]` — importa el Excel (por defecto `data/seed/caso1.xlsx`):
  muestra qué cambia por hoja y no escribe nada si no hay cambios
- `bun run pedido` — CLI que imprime la tabla de pedido por modelo leyendo la base
  (importa antes con `bun run seed`)
- `bun run backtest` — (lee la base) backtest con 4 cortes (WAPE por modelo); escribe `docs/BACKTEST.md`
- `bun run crosscheck` — validación independiente: recalcula cifras clave desde el
  xlsx crudo sin usar el motor, verifica que el pedido leído de la base sea idéntico y falla (código 1) si algo no cuadra. Es TypeScript,
  no pandas. Córrelo después de cambiar el motor o la limpieza.

## Despliegue

Vercel + Neon. Variables de entorno (`DATABASE_URL`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `SESSION_SECRET`, `ANTHROPIC_API_KEY` opcional) se configuran
en el proyecto de Vercel, nunca en el repo. `DATABASE_URL` de Neon debe ser el
connection string "pooled" (las funciones serverless de Vercel abren muchas
conexiones cortas). Migrar Neon **vacío**: la migración 0002 agrega columnas
`NOT NULL` sin default y falla sobre tablas con filas.

## Alcance de la entrega

Los dos casos son obligatorios. Caso 2 (Capesa): análisis reproducible +
prototipo descrito + sección del Word, sin segunda app; sus datos aún no están en
`data/seed/`. Ver `docs/PLAN.md` § «Caso 2».

## Fases

Ver `docs/PLAN.md` § "Plan de trabajo por fases". No avanzar a la fase
siguiente sin que el usuario revise el reporte/criterio de la fase actual.
