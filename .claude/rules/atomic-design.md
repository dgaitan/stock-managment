---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
  - "hooks/**/*.ts"
---

# Estructura de componentes: Atomic Design

```
components/
├─ ui/          # ÁTOMOS — shadcn/ui vendorizado (Button, Input, Badge…). No editar a mano;
│               #          agregar con `bunx --bun shadcn@latest add <componente>`.
├─ molecules/   # MOLÉCULAS — pocos átomos con un propósito: KpiCard, ModelSelect, AliasSuggestionRow
├─ organisms/   # ORGANISMOS — secciones con estado propio: OrderTable, StockChart, ImportSheet, WhySheet
└─ templates/   # PLANTILLAS — layout de la página sin datos reales: DashboardLayout
hooks/          # hooks propios (use-order.ts, use-import-preview.ts)
app/            # PÁGINAS — rutas; obtienen datos y llenan plantillas/organismos
```

## Reglas de dependencia (solo hacia abajo)

- `ui` no importa nada de `molecules/organisms/templates`.
- `molecules` importa solo de `ui`, `hooks` y `lib`.
- `organisms` importa de `molecules`, `ui`, `hooks` y `lib`.
- `templates` compone organismos vía `children`/props; no obtiene datos.
- `app/**` (páginas) obtiene datos en Server Components y los pasa hacia abajo.
- Nunca importar de un nivel superior ni entre organismos hermanos para
  compartir lógica: si dos organismos necesitan lo mismo, se baja a una
  molécula, un hook o `lib`.

## Convenciones

- Un componente por archivo; nombre de archivo en kebab-case
  (`order-table.tsx`), componente en PascalCase (`OrderTable`).
- **El padre controla el layout**: un componente no se posiciona a sí mismo
  (sin márgenes externos, `col-span`, `absolute` hacia afuera). El padre decide
  dónde va; el hijo llena el espacio que recibe.
- Componentes de dominio (`OrderTable`) reciben datos ya calculados por
  `lib/engine`; no recalculan reglas de negocio.
- Si un componente es de un solo uso y pequeño, puede vivir junto a su padre
  hasta que se reutilice (no forzar un nivel atómico prematuro).
