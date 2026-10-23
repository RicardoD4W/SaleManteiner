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

## Estado al 2026-10-23 (sesión de auditoría)

Rama `refactor/limpieza-y-ingles` (los 6 commits del refactor previo + los de esta sesión), **publicada en `origin`**, sin mergear a `master`.

**Auditoría** (3 frentes en paralelo, superficies disjuntas): `web/src` sin tests, `server/src` sin tests, y tests + configs + dependencias. Salieron ~110 hallazgos: se corrigieron los de severidad blocker/should y se documentaron los que son features (paginación, vistas SQL, índices, unificación de los dos mecanismos de ordenamiento).

**Corregido y commiteado**:

- `fb63b6e` + `6dc03c9`: contrato del dashboard (`neto` invertido → `ingresos`/`beneficio`/`resultado`), el bug del color del tooltip (`bg-chart-compras` ya no existía), deps muertas fuera y deps implícitas declaradas, `test` en la raíz.
- `de5af35` (server): `repo/types.ts` y `routes/_shared.ts` (tipos y helpers duplicados), `definedOnly` tipado, `StockInsufficientError` como clase, `LocalDate` con rango real, `ShortText` que rechaza el vacío, `EuroMoney` en los updates, query de clientes `.strict()`, `LIKE` escapado, status de body-parser, `statsDashboard` en transacción, `PORT` validado, `busy_timeout`, `VERSION` del package.json.
- `7c0a8f6` (web): código muerto fuera (`Badge`, `CardHeader`, `customersApi.search`, `setLight`/`setDark`, `isOpen`, `enabled`, helpers legacy de formato, `ISODateTime`), identificadores en inglés, y la página de edición de venta sin doble fetch (el `.catch(() => {})` se tragaba el error) con la caché del detalle primada con la fila completa.
- `e88af6e` (e2e): `clearAll` borra también los clientes (la suite no era idempotente), seeds con assert de status, `test.fixme` en vez de `test.skip`, `tsconfig.e2e.json` (los e2e nunca se typechequeaban) y `SALEMANTEINER_DB` fijado (con esa variable exportada, los e2e escribían en la BD real del usuario).
- `bd985aa`: las skills (`.agents/`) pasan a estar versionadas (AGENTS.md §9 las declara obligatorias y no llegaban a un clone nuevo) y AGENTS.md vuelve a estar sincronizado (§8/§8.1 describían un arnés borrado; §13 tenía nombres que ya no existen).
- `06c6fde`: un token por color (el texto de error era `text-red-600` en 16 archivos y el canónico es `text-red-700`; el success tenía dos pares distintos) y la tabla canónica de AGENTS.md al día.
- `f0640ec`: la deduplicación que faltaba, unificada en un solo lugar (tipo del 409, `apiErrorMessage`, `errorAlertClass`, `ErrorState`, `SortableTableHead` con teclado, `StatCard` + `profitColorClass`, `Button`, `invalidate`, `navLinkClass`/`cn`).
- **Bug encontrado por la verificación visual** (no por ningún test): React se quejaba de **claves duplicadas** en la lista de productos del dashboard, porque la clave era el nombre del producto (dos compras con el mismo nombre = dos filas con la misma clave). El payload de `topProducts` ahora incluye `product_id` y la clave es ese id.
- Gates: typecheck, lint, format:check, **201 tests web + 194 server + 33/33 e2e**, y la verificación visual (modales, cascada, tab de Ingresos y tablas: revisadas).
- Escaneo final: **0 comentarios, 0 exports muertos, 0 identificadores en español** (lo que queda son los alias SQL del contrato y los títulos de test, que van en español a propósito).

**Pendiente**: la deduplicación con comportamiento visible (shell de modal compartido, tabla de filas armada parametrizada y el hook del flujo de cascada) queda para una unidad propia, con su propia verificación visual.

### Lo que queda de "deduplicar todo"

El usuario eligió "deduplicar todo"; se hizo toda la deduplicación mecánica. Quedan tres refactors con comportamiento visible, que merecen su propia unidad:

1. **Shell de modal compartido** (6-8 copias del backdrop + dialog + header + botón de cerrar + Escape): un `<Modal>` con slots. Además 3 de los 6 modales manejan el Escape a mano y no atrapan el Tab (los otros sí): el shell unifica el foco y respeta `isPending`.
2. **`ArmedRowTable` parametrizado**: ~80 líneas duplicadas entre `/buys` y `/solds` (la tabla con la fila "armada").
3. **`useCascadeDeleteFlow`**: `DeleteDialogs` y `DeleteCustomerDialogs` implementan el mismo flujo 409 -> cascada (mismos 4 estados, distinto reset).

Menor y opcional: `zodResolver` en `CustomerFormModal` (hoy reimplementa el resolver a mano) y quitar el `forwardRef` de `Input`/`Textarea` (regla `react19-no-forwardref`).

### Deuda reportada (no es limpieza: son features o refactors con riesgo propio)

Se documentan para que queden decididas a propósito, no por olvido:

- **Paginación** (decisión D7 de AGENTS.md): las tres listas del repo devuelven todo sin `LIMIT`. Es una feature (cambia el contrato y el comportamiento), no un bug de limpieza.
- **Vistas SQL para el prorrateo**: la fórmula de COGS está copiada 6 veces en `solds-repo.ts` y la de beneficio en 3 (con distinto agrupamiento). Una vista (`v_item_costs`) lo unifica; es un refactor con su propio riesgo.
- **Índices**: `idx_sale_items_sold` duplica el prefijo del PK `(sold_id, buy_id)` (índice inútil) y los índices de fecha no los puede usar el planner con los filtros actuales (`(? IS NULL OR col ...)` o `strftime()`). Confirmarlo requiere `EXPLAIN QUERY PLAN` sobre una BD sembrada.
- **Dos mecanismos de ordenamiento**: `useSortable` (dashboard y clientes) y el `SortingState` de TanStack Table (`/buys`, `/solds`). Unificarlos es un refactor de las tres tablas.
- **Schemas de formulario duplicados**: los forms de compra y venta redeclaran en local lo que ya está en `web/src/schemas/` (y ya divergieron: `.default(0)` en un lado y no en el otro).
- **TOCTOU**: las rutas comprueban existencia y el repo la vuelve a comprobar.
- **Statements no cacheados**: `better-sqlite3` no cachea el SQL preparado; los `db.prepare` dentro de las funciones se recompilan en cada request (el de stock, una vez por item).
- **CORS abierto**: `origin: true, credentials: true` refleja cualquier Origin. La app es local y sin auth, pero se puede cerrar a `localhost:5173`.
- **Doble mecanismo de foco en los modales**: 3 de los 6 modales manejan el Escape a mano y no atrapan el Tab (los otros sí). Se unifica con el shell compartido (el trap respeta `isPending`, el manual no).

## Log

- **L1** (2026-10-23) — "has mirado que este todo sin comentarios? que no haya naming de cosas en español (variables, fuciones, etc), eliminado codigo que no se use? y verificado si hay redundancia? (funciones declarados dos veces, una variable css de un color y el uso de una clase de tailwind de ese mismo color en otro lado...) y que todo sigua unas buenas practicas y buena arquitectura? esto tmb aplica a test y craga las skills necesarias antes de ponerte con esto"
- **L2** (2026-10-23) — Skills cargadas antes de empezar: `web/.agents/skills/{tailwind-css-patterns, react-best-practices, composition-patterns, typescript-advanced-types, visual-verification}` y `server/.agents/skills/{vitest, zod}`. Descartadas con motivo: `seo` (SPA sin SSR, lo dice el propio SKILL.md), `accessibility` (esta auditoría no cambia modales, foco ni teclado), `frontend-design` (no se cambia la jerarquía visual), `vite` (su config ya se revisó en el barrido anterior), y `typescript-advanced-types` del server (es el mismo archivo que el de web, verificado con `diff`).
- **L3** (2026-10-23) — Auditoría en 3 frentes paralelos (superficies disjuntas): `web/src` sin tests, `server/src` sin tests, y tests + configs + dependencias. Los 3 son de solo lectura; el padre triage y decide.
- **L4** (2026-10-23) — Los 3 subagentes de auditoría terminaron, pero los 3 **writers** que después escribieron el arreglo fallaron a mitad ("assistant reported an error") y dejaron el trabajo a medias: el del server se había pasado de la raya y había sacado `getById` y `list` de la interfaz de `SoldsRepo` (los usa la suite: no son código muerto, son la API de lectura del repo), y su `LocalDate` validaba con una regex **sin grupos de captura** (rechazaba todas las fechas). El padre revisó todo el diff, corrigió ambos y completó lo que faltaba (los 4 routers usando `_shared.ts`, los tests nuevos, el status de body-parser, `PORT`, `busy_timeout`, `VERSION`).
- **L5** (2026-10-23) — El cambio del dashboard rompió la edición de venta en el e2e: la lista "arma" la fila y **prima la caché del detalle** (`setQueryData(['solds', id], ...)`) con un `Sold` pelado; como la consulta ahora espera la venta con items, la página reventaba con "Cannot read properties of undefined (reading 'length')". Se primó la caché con la fila completa (items y nombre del cliente incluidos). Confirmado leyendo el error del navegador: el crash era real, no un falso positivo del test.
- **L7** (2026-10-23) — Los 3 **writers** del arreglo fallaron ("assistant reported an error") y el cuarto se quedo colgado leyendo 12 turnos: el harness de subagentes en background no es confiable en esta sesion. El padre hizo la deduplicacion inline (con scripts para lo mecanico) y reviso cada diff a mano.
- **L8** (2026-10-23) — La deduplicacion quedo en un commit (`f0640ec`): el tipo del 409 (3 -> 1), la cadena de mensaje de error (7 -> 1), la clase de alerta (11 -> 1), el bloque "Reintentar" (8 -> 1), `SortHeader` (3 -> 1, con teclado), `StatCard` (2 -> 1), los botones "+ Nueva" (5 -> el componente), las invalidaciones de cache (10 -> 1 helper) y el helper de clases del NavLink.
- **L9** (2026-10-23) — **La verificacion visual encontro un bug que ningun test veia**: React se quejaba de claves duplicadas en la lista de productos del dashboard (la clave era el nombre del producto). Se arreglo agregando `product_id` al payload de `topProducts`. Y se **restauro** a mano un archivo que un script habia destrozado (el regex del picker se comio un bloque entero): lesson aprendida — los scripts con regex sobre JSX hay que correrlos sobre UN archivo y revisar el diff, no sobre el repo.
- **L10** (2026-10-23) — El check automatico de pi-lens reporto como blocker un `ReactNode` sin importar en `StatCard.tsx` **despues** de corregirlo: era una instantanea vieja (llegaba a reportar el finding de un archivo donde el simbolo ya no existia). Se verifico con `read`, `tsc --noEmit`, la sonda LSP (0 diagnosticos), un `rewrite` del archivo y el typecheck del workspace: en todos los casos limpio. Es un falso positivo del checker, no un defecto del codigo.
