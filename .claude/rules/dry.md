# DRY — sin repetir conocimiento, sin abstracciones equivocadas

DRY trata de **conocimiento**, no de líneas parecidas. Cada regla de negocio,
parámetro o constante tiene una sola fuente de verdad.

## Fuentes únicas de verdad en este proyecto

| Conocimiento | Única fuente |
| --- | --- |
| Supuestos de pronóstico (pesos, z, umbrales, ventanas) | `config/cycle.yaml` vía `lib/engine/config.ts` |
| Corte, ventana, llegada y cobertura del ciclo | `lib/engine/cycle.ts` (se derivan de los datos) |
| Lotes y regla RAV4 | tabla `cycle_rules` (semilla: `config/cycle_rules.yaml`), resueltas por `lib/engine/rules.ts` |
| Cálculo del pedido | `lib/engine/*` (la UI y la CLI lo consumen, no lo replican) |
| Esquema de datos | `lib/db/schema.ts` (tipos con `InferSelectModel`/`z.infer`, no a mano) |
| Validación de entrada | esquemas `zod`, compartidos entre cliente y servidor |
| Normalización de nombres/alias | `lib/engine/clean.ts` |
| Textos del "por qué" | `lib/engine/explain.ts` |

Si ves el mismo número, regla o texto en dos lugares, uno de ellos sobra.

## Cuándo NO abstraer

- **Regla de tres**: duplicar una vez es aceptable; abstraer a la tercera
  repetición, cuando el patrón ya es claro.
- "La duplicación es mucho más barata que la abstracción equivocada" (Sandi
  Metz). Dos bloques que se parecen pero cambian por razones distintas
  **no** se unen.
- Una abstracción no debe mezclar responsabilidades (p. ej. un `Badge` que
  además se posiciona en una esquina). Responsabilidad única: una sola razón
  para cambiar.
- No agregar parámetros o flags a una función compartida para cubrir un caso
  nuevo; si se necesitan `if (modo === …)` internos, son dos funciones.
- Sin configurabilidad especulativa ni chequeos defensivos innecesarios en
  código de aplicación.
- Evitar pasar `className`/`style` a componentes de dominio para "ajustarlos";
  el padre controla el layout envolviendo al hijo.
