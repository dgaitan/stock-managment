---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
  - "hooks/**/*.ts"
---

# Buenas prácticas de React

Para rendimiento, aplicar el skill `react-best-practices` (Vercel), priorizando
sus categorías CRITICAL: eliminar cascadas async y reducir el bundle. Para API
de componentes, el skill `composition-patterns`. Esta regla no las repite;
agrega lo específico del proyecto.

## Componentes

- Solo componentes funcionales con TypeScript; props tipadas con `type` y sin
  `any`.
- Server Component por defecto. `"use client"` solo en la hoja interactiva más
  pequeña posible (un botón, un drawer), nunca en una página completa.
- Sin estilos inline (`style={{…}}`); usar Tailwind y las variantes de shadcn.
- Más de 4 `useState` relacionados o transiciones complejas → `useReducer`.
- Lógica con estado reutilizable → custom hook en `hooks/`.
- Props que bajan más de 2 niveles → composición (`children`) o contexto, no
  prop drilling.
- Muchas props booleanas que cambian el comportamiento (`isX`, `showY`) →
  variantes explícitas o componentes compuestos (ver `composition-patterns`).

## JSX

- `key` estable y único (id del modelo, `line_hash`), nunca el índice del array.
- Fragments (`<>…</>`) en lugar de `div` vacíos.
- Etiquetas auto-cerradas para componentes sin hijos.
- Props booleanas abreviadas (`<Sheet open />`) y strings sin llaves
  (`title="Pedido"`).
- Separar props propias antes de hacer `{...rest}` sobre un elemento DOM.
- Nunca `dangerouslySetInnerHTML` (el texto de `explain.ts` es texto plano).

## Errores y estado asíncrono

- `try/catch` en código async del cliente con mensaje en español visible al
  usuario; nunca tragar errores en silencio.
- Cada segmento con datos tiene `loading.tsx` o `<Suspense>`, y `error.tsx`.

## Imports y nombres

- Orden: paquetes externos → alias `@/` → relativos.
- PascalCase para componentes y tipos; camelCase para variables y funciones;
  kebab-case para nombres de archivo.
- Textos visibles en español.
