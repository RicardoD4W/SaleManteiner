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
| T3a | S2, S3 | web: los forms derivan del schema + `zodResolver` + ref como prop | pendiente    |
| T3b | S1     | web: hook de cascada compartido (`useCascadeDeleteFlow`)          | pendiente    |
| T4  | S1     | web: `<Modal>` compartido (6 modales)                             | pendiente    |
| T5  | S1     | web: tabla con fila armada parametrizada                          | pendiente    |
| T6  | S1-S3  | gates + verificación visual                                       | pendiente    |

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
