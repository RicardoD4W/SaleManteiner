# Feature: auditoría de calidad del código (comentarios, naming, código muerto, redundancia, buenas prácticas)

Auditoría **de fondo** del repo tras el refactor de limpieza: que no quede ni un comentario, ni un identificador en español, ni código muerto, ni redundancia, y que el código siga buenas prácticas y una arquitectura sana. Aplica **también a los tests**.

**Riesgo del feature**: item 3 (se tocan contratos que otros consumen: si un export "muerto" en realidad lo usa otro workspace, o si un tipo duplicado era la fuente de un import, el typecheck lo detecta; el riesgo real es el visual, si se unifican tokens de color) — mitigado con los gates (typecheck, lint, format, tests, e2e) y la verificación visual de lo que toque la UI.

## Specs

### S1 — Sin comentarios en el código

> "has mirado que este todo sin comentarios?"

Regla:

- Cero comentarios en el código de `web/`, `server/` y los configs: `//`, `/* */`, `<!-- -->`, `--` en SQL y JSONC.
- Solo se aceptan las **directivas funcionales** (no son comentarios): `eslint-disable*`, `@ts-*`, `prettier-ignore`, `/// <reference ...>`.
- El conocimiento "por qué" que estaba en los comentarios vive en Engram (`mem_save`) **antes** de borrarlo.

Criterio de aceptación: el escaneo de comentarios da 0 en todo el repo.

### S2 — Sin naming en español

> "que no haya naming de cosas en español (variables, fuciones, etc)"

Regla:

- Identificadores (variables, funciones, parámetros, tipos, props, clases CSS, `data-*`) en inglés.
- Se exceptúan, **a propósito**: los **strings de UI** (lo que ve el usuario, en español), los **títulos de los tests** (español) y las **claves del contrato HTTP** (`compras`, `ventas`, `neto`, `associated_sales`…), que son el contrato entre server y web.

Criterio de aceptación: el listado de identificadores del AST no tiene palabras en español.

### S3 — Código muerto eliminado

> "eliminado codigo que no se use?"

Regla:

- Se elimina lo que se puede **probar** que no se usa: exports sin ningún uso (ni interno ni externo), fixtures/helpers de test sin uso, dependencias declaradas que no se importan, y archivos que nadie importa.
- Las dependencias **usadas pero no declaradas** se declaran (no se dejan resolutionsueltas por el hoisting de npm).
- No se toca: los tests, el contrato HTTP, el esquema de la BD.

Criterio de aceptación: el escaneo de exports muertos y de dependencias sin uso da 0.

### S4 — Sin redundancia

> "y verificado si hay redundancia? (funciones declarados dos veces, una variable css de un color y el uso de una clase de tailwind de ese mismo color en otro lado...)"

Regla:

- Tipos y helpers declarados dos veces (en dos archivos) → uno solo, en un módulo compartido.
- Dos nombres para el mismo tipo con **formas distintas** (`ListFilters` en compras y en ventas) → nombres distintos y explícitos.
- El mismo color semántico resuelto de dos formas distintas (una clase de Tailwind en un archivo y otra en otro; una variable CSS y una clase) → una sola fuente.
- Las duplicaciones **deliberadas** se documentan, no se "arreglan": los schemas Zod de `server/src/schemas/` y `web/src/schemas/` (defensa en profundidad) y el helper `round2` (uno por workspace).

Criterio de aceptación: no quedan dos declaraciones del mismo tipo con la misma forma; los tokens de color tienen una sola fuente.

### S5 — Buenas prácticas y arquitectura

> "y que todo sigua unas buenas practicas y buena arquitectura?"

Regla:

- Se aplican las skills del workspace (Tailwind, React best practices, Composition patterns, TypeScript advanced types, Zod, Vitest) como criterio.
- Superficie de API de los módulos acotada: lo que solo se usa dentro de su archivo no se exporta.
- La documentación del repo (`AGENTS.md`) queda **sincronizada** con el código real (no puede seguir describiendo archivos borrados ni clases renombradas).

Criterio de aceptación: los gates verdes y `AGENTS.md` sin referencias a código inexistente.

### S6 — Aplica también a los tests; las skills se cargan antes

> "esto tmb aplica a test y craga las skills necesarias antes de ponerte con esto"

Regla:

- Los tests entran en la auditoría: identificadores en español, fixtures muertas, helpers duplicados, títulos que ya no describen lo que hacen, tests tautológicos, aislamiento de la BD real (§0.2 de AGENTS.md).
- **Antes** de la primera lectura o edición del workspace se cargan las skills pertinentes del workspace tocado (AGENTS.md §9), y las que no aplican se descartan **con el motivo** anotado.

Criterio de aceptación: los tests están cubiertos por la auditoría y las skills cargadas quedan registradas en el informe del turno.

## Tasks

| ID  | Spec       | Ruta                                                               | Commit |
| --- | ---------- | ------------------------------------------------------------------ | ------ |
| T1  | S1, S2, S6 | escaneo mecánico + identificadores en español (web, server, tests) | WU1    |
| T2  | S3         | código muerto: exports, fixtures, dependencias                     | WU2    |
| T3  | S4, S5     | redundancia de tipos y superficie de API (server + web)            | WU3    |
| T4  | S4, S5     | tokens de color: una sola fuente + `AGENTS.md` sincronizado        | WU4    |
| T5  | S1-S6      | gates (typecheck, lint, format, tests, e2e) + verificación visual  | WU5    |

## Log

- **L1** (2026-10-23) — "has mirado que este todo sin comentarios? que no haya naming de cosas en español (variables, fuciones, etc), eliminado codigo que no se use? y verificado si hay redundancia? (funciones declarados dos veces, una variable css de un color y el uso de una clase de tailwind de ese mismo color en otro lado...) y que todo sigua unas buenas practicas y buena arquitectura? esto tmb aplica a test y craga las skills necesarias antes de ponerte con esto"
- **L2** (2026-10-23) — Skills cargadas antes de empezar: `web/.agents/skills/{tailwind-css-patterns, react-best-practices, composition-patterns, typescript-advanced-types, visual-verification}` y `server/.agents/skills/{vitest, zod}`. Descartadas con motivo: `seo` (SPA sin SSR, lo dice el propio SKILL.md), `accessibility` (esta auditoría no cambia modales, foco ni teclado), `frontend-design` (no se cambia la jerarquía visual), `vite` (su config ya se revisó en el barrido anterior), y `typescript-advanced-types` del server (es el mismo archivo que el de web, verificado con `diff`).
- **L3** (2026-10-23) — Auditoría en 3 frentes paralelos (superficies disjuntas): `web/src` sin tests, `server/src` sin tests, y tests + configs + dependencias. Los 3 son de solo lectura; el padre triage y decide.
