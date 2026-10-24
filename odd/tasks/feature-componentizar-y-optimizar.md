# Feature: componentizar, una fuente de la verdad y optimizar

Cerrar la deuda técnica que dejó la auditoría: **reutilizar** lo que está duplicado, dejar **una sola fuente de la verdad** para cada cosa y **optimizar** (índices, SQL preparado, TOCTOU).

**Riesgo del feature**: item 3 (se tocan contratos que otros consumen: las cifras del dashboard, el contrato HTTP y el foco de los modales) — mitigado con los gates (typecheck, lint, format, tests, e2e) y **verificación visual** en las unidades que tocan la UI.

## Specs

### S1 — Reutilizar: un componente donde hoy hay copias

> "si tenemos la misma estructura podemos componetizar y reutilizar"

- El **shell de modal** (backdrop + `role="dialog"` + header + botón cerrar + footer) vive hoy **6 veces** → un `<Modal>` con slots, y el foco/Escape unificados (3 de los 6 modales hoy manejan el Escape a mano y no atrapan el Tab).
- La **tabla con la fila "armada"** está duplicada entre `/buys` y `/solds` (~80 líneas: `transitionName`, `readArmedRow`, `ArmedRowContext`, `TravellingCell`, `ActionsCell`) → un componente parametrizado.
- El **flujo de borrado en cascada** (409 → modal de cascada) está implementado dos veces (`DeleteDialogs` y `DeleteCustomerDialogs`, con los mismos 4 estados) → un hook compartido.

### S2 — Una sola fuente de la verdad

> "solo debemos de tener una fuente de la verdad"

- **Las cifras del dashboard**: la fórmula de prorrateo (COGS) está **6 veces** y la de beneficio **3 veces** (con distinto agrupamiento) → **vistas SQL** en una migración nueva, y los repos consultan la vista.
- **Los schemas de los forms**: redeclaran en local lo que ya está en `web/src/schemas/` (y ya divergieron: `.default(0)` en un lado y no en el otro) → derivarlos del schema.
- **La validación del form de cliente**: `buildResolver()` reimplementa a mano lo que `zodResolver` ya hace en las otras 3 formas → `zodResolver`.
- **Los tipos del 409** ya están unificados en `api/types.ts` ✓ (hecho en la auditoría).

### S3 — Optimizar

> "optimizar, reducir codigo y corregir posiblwes errores futuros"

- **Índices**: `idx_sale_items_sold` duplica el prefijo del PK `(sold_id, buy_id)` → no aporta nada → se va. Los índices de fecha se **miden** (`EXPLAIN QUERY PLAN`) antes de decidir: si no los usa el planner, se van o se reescribe el filtro para que sirvan.
- **Statements**: `better-sqlite3` no cachea el SQL → los `db.prepare()` que hoy están **dentro de las funciones** (5/7/7 por repo) se suben al factory (se compilan una vez).
- **TOCTOU**: la ruta comprueba la existencia y el repo la vuelve a comprobar → el repo devuelve un resultado discriminado y la ruta mapea al 404 (una sola comprobación).
- **Menos código**: lo que se unifica se borra (copias, `forwardRef` de React 18, helpers que quedan sin uso).

## Tasks

| ID  | Spec   | Ruta                                                              | Commit       |
| --- | ------ | ----------------------------------------------------------------- | ------------ |
| T1  | S2, S3 | server: vistas SQL (fuente de verdad de las cifras) + índices     | `cde94a9` ✅ |
| T2  | S3     | server: statements en el factory + TOCTOU                         | `4ab47b1` ✅ |
| T3a | S2, S3 | web: los forms derivan del schema + `zodResolver` + ref como prop | `5deb2f1` ✅ |
| T3b | S1     | web: hook de cascada compartido (`useCascadeDeleteFlow`)          | `4099923` ✅ |
| T4  | S1     | web: `<Modal>` compartido (6 modales)                             | `6d13c4b` ✅ |
| T5  | S1     | web: tabla con fila armada parametrizada                          | `631d940` ✅ |
| T6  | S1-S3  | gates + verificación visual                                       | `6db8d81` ✅ |

## Log

- **L1** (2026-10-23) — El usuario pide cerrar la deuda técnica: "si tenemos la misma estructura podemos componetizar y reutilizar no? eso hara un mejor software, solo debemos de teenr una fuente de la verdad, si el indice entorpecerá quitemoslo, el 6 hayq acerlo optimo, 7. arreglalo. Como resumen optimizar, reducir codigo y corregir posiblwes errores futuros".
- **L2** (2026-10-23) — Los 5 detalles de la tabla de la auditoría anterior (CORS abierto, `cursor-pointer` en 16 botones crudos, anillo de foco del "Borrar", `role="status"` del Spinner y la paginación de D7) quedan **descartados** por el usuario: no se tocan.
- **L3** (2026-10-23) — **La sesión se cortó a mitad de WU3.** Quedaron commiteadas T1 (WU1) y T2 (WU2), y **sin commitear** los primeros archivos de T3 (`web/src/schemas/fields.ts` nuevo + `common.ts`/`buys.ts`/`solds.ts`/`customers.ts` migrados a los campos compartidos). Los forms todavía redeclaran su schema en local, `buildResolver` sigue a mano, `Input`/`Textarea` siguen con `forwardRef` y el hook de cascada no existe.
- **L4** (2026-10-23) — Se retoma el feature en la rama `feature/componentizar-y-optimizar` (desde `master`, que ya tenía WU1/WU2 sin pushear). WU3 se parte en dos commits revisables: **T3a** (la fuente de la verdad de los forms: schemas derivados, `zodResolver`, ref como prop) y **T3b** (el hook de cascada compartido). T4 (el `<Modal>` compartido) y T5 (la tabla con la fila armada) se delegan como dos unidades independientes con superficies de edición disjuntas.
- **L5** (2026-10-23) — **Bugs que esta unificación tiene que arreglar de paso** (no son cosmology: son los que la duplicación ya había permitido):
  - El nombre del cliente: el server rechaza un nombre que solo tiene espacios (`ShortText` con `.refine(trim)`), pero el form solo miraba `min(1)` → el cliente escribía " ", el form lo daba por bueno y el server respondía 422. El schema del web tiene que reflejar la regla del server.
  - El mismo campo se validaba distinto según la pantalla (`.default(0)` en `associated_costs` en una forma y no en la otra). Con un solo schema, las dos pantallas validan igual.
  - `buildResolver` (a mano) y `zodResolver` (en las otras 3 formas) eran dos caminos de validación: el manual además hacía su propio `trim()`.
- **L6** (2026-10-23) — **WU3a encontró un bug que nadie sabía: la validación del cliente nunca se veía en los forms con `zodResolver`.** La causa no era RHF ni Zod: el `<input type="number" step="0.01" min="0">` hace que el **navegador bloquee el envío** con su validación nativa (el "step mismatch" de `10.005` y el `min` de los negativos), así que el `submit` no llegaba a RHF y **la validación de Zod no corría nunca**: el usuario veía el cartel del navegador (en el idioma del navegador) y nunca el mensaje de la app. Se verificó en Chromium con un e2e (no solo en jsdom).
  - **Fix: `noValidate` en los forms.** Así el schema es la **única** fuente de la verdad de la validación (y los mensajes son los de la app, en español, con su estilo). Los atributos `min`/`step` se quedan como ayuda de teclado y de la ruleta del input.
  - El schema del web ahora tiene la **misma regla que el server** para los textos: un producto o un nombre de cliente de solo espacios no es válido (antes el web lo aceptaba y el server lo rechazaba con un 422).
  - La fecha del form ahora valida el calendario (igual que el server: `2026-02-30` no vale), no solo el formato.
  - `buildResolver` (28 líneas a mano) fuera: `zodResolver` + el schema compartido.
  - `forwardRef` fuera (React 19: el `ref` es un prop normal) y con él los **2 merges manuales de refs** que hacía falta para tener el ref de RHF y el propio.
  - El `useFocusTrap` ahora acepta `initialFocusSelector`, así el modal de cliente enfoca su input sin el merge de refs.
- **L7** (2026-10-23) — **Trampa al copiar el regex de la fecha del server al web**: el del server es `/^(\d{4})-(\d{2})-(\d{2})$/` (con grupos) y sin ellos `match[1]` era `undefined` → `NaN` → **toda fecha del web era inválida**. Lo detectó el test del schema (una fecha real tiene que aceptarse); el server nunca estuvo afectado.
- **L8** (2026-10-23) — **Límite de slice**: WU3a son 839 líneas y WU3b 151 → 1516 en dos commits, por encima de los ~400 que pide el slice. No se pudieron partir más sin dejar el repo en un estado roto: el fix de la validación (L6) y la unificación de los schemas son la **misma unidad** (si el schema no está unificado, el `noValidate` no tiene a qué atenerse) y el fix tenía que ir con sus tests. La estrategia de entrega del feature es, entonces, **una unidad por commit** (WU3a, WU3b, WU4, WU5) y el slice largo se acepta a conciencia: la revisión va por commit, no por el diff acumulado.
- **L9** (2026-10-23) — **T4 y T5 se delegan en paralelo** (son dos unidades independientes, sin superficies de edición en común): WU4 = el shell de los 6 modales (`web/src/components/ui/Modal.tsx` + los 6 modales), WU5 = la tabla con la fila armada (`web/src/components/ui/armedRow.tsx` + las 2 páginas de lista). La verificación visual (T6) es del orquestador, con el arnés armado **fuera del repo** (en el directorio temporal), como manda AGENTS.md §8.1.
- **L10** (2026-10-23) — **Los dos workers de T4 y T5 cortaron a mitad** (el subagente reporto un error), pero dejaron el trabajo prácticamente hecho: el `<Modal>` con sus 15 tests, los 6 modales migrados, el módulo `armedRow` y las 2 páginas de lista. **El orquestador revisó el diff y corrigió lo que faltaba**:
  - `Modal.tsx`: `children` era obligatorio y su propio test lo renderizaba sin cuerpo → ahora es opcional; y `ModalSize` no se exportaba (Knip lo marcaba como export sin uso) → es un tipo local.
  - **El worker se había comido un comportamiento del `SaleNewModal`**: al cerrar el picker de productos ("+ Cambiar productos") el foco volvía al campo del precio, y con el `<Modal>` (que enfoca al montar) eso se perdía, porque el form no se remonta. Restaurado con un efecto que reenfoca `#sale-price` y con un test que lo pinnea ("al cerrar el picker de productos el foco vuelve al precio").
  - Se revisó uno por uno los comportamientos del foco y el Escape de los 6 modales contra los que tenía antes (Escape con el picker abierto cancela el picker y no la venta; el foco inicial del botón destructivo, del input del nombre y del buscador; el backdrop y el botón "Cerrar" no hacen nada mientras guarda) → quedan iguales y con tests.
  - Se revisó que los nombres de la view transition sigan siendo exactamente los mismos (`buy-<campo>-<id>` / `sold-<campo>-<id>`), que es lo que el CSS y el e2e pinnean.
- **L11** (2026-10-23) — **Bug de a11y que encontró la unificación**: los errores de los forms ya se ven (antes no aparecían nunca) pero el `Input`/`Textarea` no los anunciaban: un lector de pantalla no se enteraba. Ahora el mensaje de error va con `role="alert"` (la skill de accesibilidad lo pide).
- **L12** (2026-10-23) — **T6: los gates y la verificación visual.**
  - Gates: typecheck ✓, lint ✓, format:check ✓, **194 tests server** ✓, **247 tests web** ✓ (32 archivos), **36 e2e** ✓ (Chromium, incluidos 3 nuevos de la validación).
  - **Verificación visual** (AGENTS.md §0.1): el arnés se armó **fuera del repo** (en el directorio temporal), contra una BD temporal, y se capturaron **18 pantallas**: los 4 tabs del dashboard, las 3 listas, los 6 modales (nueva compra, picker, nueva venta, confirmar borrado, cascada, cliente), las 2 páginas de edición, el dark mode (3) y el móvil 390px (3). **Las 18 se miraron**: el shell de los modales quedó igual que antes (backdrop, header, botón "Cerrar", footer), el foco cae donde tenía que caer (el input del producto, el buscador, el nombre del cliente, el precio de la venta) y no hay ninguna columna cortada, texto partido, chart en su fallback ni color sin contraparte `dark:`. **0 errores de consola** (el único "error" es el 409 esperado del escenario de borrado en cascada).
  - La **revisión nativa (RDD)** no pudo correr: `gentle-ai review assess` devuelve `package-local-binary-missing` (el binario no está en esta máquina) → `nativeRisk: unassessable`. El plan que devuelve el assess pide la **auto-verificación del writer** (hecha: los gates + las capturas) y **no** un verificador aparte. Igual se lanzó un **verificador independiente** (`gentle-ai-verify`, solo lectura) sobre las dos unidades de riesgo del feature (las cifras del dashboard y el foco/Escape de los modales), porque el propio feature declara riesgo item 3.
- **L13** (2026-10-23) — **Lo que NO entra en este feature**: el punto 8 de la auditoría (los dos mecanismos de ordenamiento: el `SortingState` de TanStack en 3 tablas y el hook `useSortable` en el dashboard y `/customers`). No estaba en el spec (S1-S3) y es el más grande de los 11: migrar las 3 tablas de TanStack al hook propio. Queda anotado en AGENTS.md §12 como decisión pendiente, no como deuda oculta.
- **L14** (2026-10-23) — **El balance del feature** (`master..feature/componentizar-y-optimizar`): el código de producción **bajó** (web + server: 1032 líneas agregadas, 1251 quitadas → **neto −219**; en los modales, la UI y las páginas, que es donde estaba la duplicación: **neto −424**) y los tests **crecieron** (neto **+976**: 40 casos nuevos entre unitarios y e2e, más el `Modal.test.tsx` de 15 casos). O sea: **menos código y más cobertura**, que era el objetivo.
- **L15** (2026-10-23) — **Verificación independiente** (`gentle-ai-verify`, solo lectura) sobre las dos unidades de riesgo: **sin bloqueantes**, pero encontró 3 cosas que se corrigieron.
  - **La migración 004 se había editado después de aplicada** (el commit `4ab47b1` le metió los `DROP INDEX` de fecha): una migración aplicada no se vuelve a correr → las bases ya migradas (incluida la del usuario) **nunca recibían esos índices** y los cambios de la vista no llegaban a nadie. **Corregido**: la 004 vuelve a su contenido original y los `DROP INDEX` de fecha van en una **migración nueva** (`005_indices_de_fecha.sql`, con `IF EXISTS` para que no rompa a quien ya los había tirado).
  - **El hook de cascada perdía el error** si un 409 llegaba en un recurso sin cascada posible (hoy el borrado de ventas no da 409, pero el hook no lo sabía): ahora el llamador dice `canCascade` y, si no puede, el 409 se muestra como error.
  - **La vista no implementaba la fórmula escrita en el AGENTS.md** (SQLite `ROUND` vs `round2` de JS: en empates exactos de 3 decimales pueden diferir 1 céntimo). Es el comportamiento pre-existente del SQL, pero el feature la institucionaliza como fuente de la verdad → **el AGENTS.md quedó alineado con el código** y el comportamiento quedó pineado.
  - **Tests de regresión nuevos**: `server/src/__tests__/vistas-cifras.test.ts` (el beneficio de la vista == la fórmula de antes, la lista == la vista y el total del dashboard == la suma de la vista), `server/src/__tests__/planner.test.ts` (el filtro por cliente usa `idx_solds_customer` y los índices de fecha no hacen falta) y `web/src/schemas/__tests__/fields.test.ts` (la matriz del web == la del server).
  - **Un trade-off que queda anotado**: la vista `v_sold_costs` **materializa** el COGS de todas las ventas, así que el listado **con filtro de cliente** se va de 0,29 ms a 11 ms con 4.800 ventas (el listado sin filtro, que es el que usa la web, solo va de 0,29 a 0,35 ms). El filtro por cliente no lo usa nadie hoy (el web no filtra por cliente ni por fecha) y a 50 ventas/mes es irrelevante; si algún día se usa, la vista hay que repensarla.
  - Lo demás que señaló: el web **recalcula** dos cifras del dashboard en el cliente (`ytdProfit` en la tab Ingresos y el `total gastado` de Clientes) → una segunda fuente para esos números (preexistente, fuera del diff).
