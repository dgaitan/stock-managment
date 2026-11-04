---
paths:
  - "app/**/*"
  - "lib/**/*.ts"
  - "proxy.ts"
  - "next.config.ts"
---

# Next.js 16 — checklist de producción

Basado en el production checklist de Next.js (copia local en
`node_modules/next/dist/docs/01-app/02-guides/production-checklist.md`).
Esta versión cambia APIs: lee la guía en `node_modules/next/dist/docs/` antes
de usar una API que no hayas verificado.

## Diferencias de Next 16 que afectan este proyecto

- `middleware.ts` está **deprecado**: el login usa `proxy.ts` con
  `export function proxy()`. `docs/PLAN.md` dice "middleware"; se refiere a esto.
- `global-not-found.js` sigue siendo experimental: usar `app/not-found.tsx`
  y `app/error.tsx` (+ `app/global-error.tsx`).

## Renderizado y datos

- Obtener datos en Server Components. Las Route Handlers (`app/api/**`) son
  para Client Components; **un Server Component nunca hace `fetch` a su propia
  API**: llama la función de `lib/` directamente.
- Fetches independientes en paralelo (`Promise.all`), no en cascada.
- `cookies()`/`searchParams` hacen dinámica la ruta: úsalos solo donde se
  necesitan y envuelve en `<Suspense>`.
- `loading.tsx` o `<Suspense>` para streaming.
- Formularios/mutaciones (importar, nuevo registro) con Server Actions o Route
  Handlers que validan con `zod` en el servidor.

## Seguridad

- Acceso a la base solo en una capa de datos de servidor (`lib/db/**`,
  `lib/data/**`) marcada con `import "server-only"`.
- **Cada** Server Action y Route Handler verifica la sesión por sí mismo;
  no basta con `proxy.ts` ni con el layout.
- Nada de secretos en variables `NEXT_PUBLIC_*`. `.env*` en `.gitignore`.
- No pasar a Client Components objetos completos de la base: solo los campos
  que se muestran.

## UI y metadatos

- `next/font` para fuentes, `next/image` para imágenes, `next/link` para
  navegación.
- `metadata` exportado en `app/layout.tsx` (título y descripción en español).
- Mantener `eslint-config-next` (incluye `jsx-a11y`) sin desactivar reglas.

## Antes de desplegar

- `bun run build` local sin errores ni warnings nuevos, y `bun run start` para
  probar en modo producción.
