---
paths:
  - "app/**/*.{ts,tsx}"
  - "components/**/*.{ts,tsx}"
  - "hooks/**/*.{ts,tsx}"
  - "lib/**/*.{ts,tsx}"
  - "scripts/**/*.{ts,tsx}"
---

# Tamaño de archivos: máximo 300 líneas

Ningún archivo de `app/`, `components/`, `hooks/`, `lib/` o `scripts/` supera
300 líneas (contando comentarios y líneas en blanco). Lo impone ESLint
(`max-lines` en `eslint.config.mjs`); `bun run lint` falla si se rompe.

Exentos: `components/ui/**` (shadcn vendorizado, no se edita a mano),
`drizzle/**` (generado) y `tests/**`.

## Cómo dividir antes de llegar al límite

Si un archivo pasa de ~250 líneas, divídelo **antes** de seguir agregando:

| Síntoma | Extraer a |
| --- | --- |
| Lógica con estado/efectos reutilizable en un componente | hook en `hooks/use-<nombre>.ts` |
| Bloque de JSX con responsabilidad propia | subcomponente (ver `atomic-design.md`) |
| Funciones puras de formato/cálculo | `lib/<dominio>/<nombre>.ts` |
| Tipos compartidos | `lib/<dominio>/types.ts` |
| Constantes/textos largos | archivo junto al componente (`<nombre>.constants.ts`) |
| Varias etapas de un pipeline en `lib/engine` | un archivo por etapa |

Divide por **responsabilidad**, no por número de líneas: dos mitades
arbitrarias de un mismo concepto son peor que un archivo largo coherente.
Nunca desactives `max-lines` con `eslint-disable`.
