# Feature: delete cascade de compras + pulido UX de listados y dashboard

Cierra el batch de pedidos del usuario del 2026-10-19 que quedó **in-flight sin commitear ni trackear**: el borrado de compras con ventas asociadas (409 explicativo + cascada con confirmación), la columna "Productos" y el stock real en `/solds`, los KPI del dashboard y el pulido de navegación (view transitions, sort idle, autocomplete que se contrae).

**Riesgo del feature**: item 1 (data / efectos irreversibles) — el cascade borra ventas de forma permanente.

## Specs

### S1 — Borrar una compra con ventas asociadas no puede dar 500

> "1- si quieres eliminar una compra de la cual ya has vendido te da un error 500, podria dar un msg mas descriptivo o dar opcion a eliminar la/las ventas asociada"

Regla: `DELETE /api/buys/:id` con ventas asociadas **no** propaga el error de FK `sale_items.buy_id ON DELETE RESTRICT` como 500. Responde 409 con un mensaje descriptivo y la lista de ventas afectadas.

### S2 — Diseño aprobado del borrado en dos modos (híbrido)

> "1. `DELETE /api/buys/:id` por defecto → 204 si OK, 404 si no existe, **409** con `{ error, associated_sales: [...] }` si la compra tiene ventas asociadas.
> 2. `DELETE /api/buys/:id/cascade` → borra la compra + limpia las ventas asociadas. Si una venta tiene items de OTRAS compras (pack), solo quita este item del pack; si la venta queda con 0 items, la borra.
> 3. UI: el catch del delete normal, si recibe 409, abre un modal con la lista de ventas asociadas y un botón "Borrar también las ventas y la compra" que llama al endpoint cascade. Doble confirmación (el modal ya es confirmación) + el texto tiene que nombrar qué se va a borrar."

Literales exactos del contrato:

- 409: `error` = `'No se puede borrar: la compra tiene ventas asociadas. ¿Querés borrar también las ventas?'`
- 409: `associated_sales: [{ id, customer_name, sold_at, items_count }]`
- Botón de la modal: `"Borrar también las ventas y la compra"`
- Título de la modal: `"La compra tiene ventas asociadas"`
- 404 (ambas rutas): `error` = `'Compra no encontrada'`
- 400 (id no numérico): `error` = `'Id inválido'`

### S3 — Stock real en `/buys` y productos vendidos en `/solds`

> "el flujo: he creado un producto de 10€ con 10 unidades en stock, cree el comprador, le vendi 2 unidades. En el tab de compras dice que ya no tengo unidades cuando deberia tener 8, en el tab de ventas no dice que producto vendí, ni cuantas unidades"

Regla: `/buys` muestra las unidades **disponibles** (compradas − vendidas) y `/solds` lista los productos de cada venta con su cantidad, sin abrir el detalle.

### S4 — KPI del dashboard con color y literales del usuario

> "2- quiero que ne dasboard 'Compras totales' salga en un rojo clarito y 'Ventas totales' un verde clarito
> 3- voy a cmabiar un par de literales, dejalos asi"

Literales que quedan fijados por el usuario: `"Gastos en compras acumulados"`, `"Beneficios de ventas"`, `"Beneficio - compras - costes asociados"`, `"Productos en el almacén"` / `"Producto en el almacén"`.

### S5 — "Top 5 productos" cuenta unidades vendidas

> "4- en top 5 productos hay que reinterpretarlo, compre 10 sobres y vendi 2, `pero en 'Top 5 productos' sale sobre 4€ 1x, deberia salir 2x poerque vendi 2 sobres. Sin embargo 'Top 5 compradores' esta perfecto, no lo toques"

Regla: `times_sold` = unidades vendidas (`SUM(si.quantity)`), no cantidad de filas de `sale_items`. **"Top 5 compradores" no se toca.**

### S6 — El nombre del producto en `/buys` no abre la edición y el sort arranca en idle

> "2. en la ruta '/buys' , en la tabla de 'Compras', en nombre del producto está en naranja (me parece ok), pero cuando haces click en él se abre la edición, no quiero que se pueda editar dando click en el nombre. También en esa misma tabla por defecto hay un order aplicado asc a la columna 'Producto', de normal no deberian tener filtro aplicado, deberia estar en el estado idle, ni ascendente ni descendente"

Regla: el nombre del producto se renderiza como texto (conserva el color brand), no como link. La edición sigue disponible desde la columna "Acciones". El sort inicial de la tabla es `[]` (idle, sin asc ni desc).

### S7 — Sort inicial en idle también en `/solds`

> "igual qu e arreglaste el ordenamiento por defeto en la tabla de compras, hazlo en la de ventas, que por defecto, pasa lo mismo que pasaba en la celda 'Producto', pero esta vez en la '''Fecha'"

### S8 — View transitions en toda la navegación

> "podemos agregar view transitions de '/buys' -> '/buys/{id}' ? y lo mismo para '/solds' -> '/solds/{id}'"
>
> "quiero que lo hagas tmb para cuando le demos click a cualquier boton del header, compras, ventas, dashboards...
>
> y la view transition de /solds a /solds/{id} esta hecha pero no esta hecha de /solds/{id} a /solds, lo mismo para /buys"
>
> "has hecho la transicion cuando le das a  '<- Volver' hazlo tmb con cualquier boton que cambie de ruta"

Regla: toda navegación por click (nav del header, tabs del dashboard, links "Editar", "← Volver", botones Cancelar, submit y post-borrado) usa `viewTransition`. Cubre **ida y vuelta** (`/x` → `/x/:id` → `/x`).

### S9 — El autocomplete de clientes se contrae al perder el foco

> "cuando le das a nueva venta, y le das click a cliente, se despliega una lista de cleintes, pero deberia contraerse cuando se pierda el foco"

Regla: la lista de clientes se cierra en `blur` del input, sin romper la selección por click (el `mousedown` de la lista no puede robar el foco) ni la navegación por teclado.

### S10 — El contrato HTTP del borrado tiene que estar pinneado (H1, review)

El flujo 409 → modal → cascade no estaba cubierto por ningún test: los tests del server son a nivel repo (no hay supertest en el repo) y el e2e solo borraba una compra **sin** ventas. El mapeo a 409, el body `{ error, associated_sales }`, el 404, el 400 y el path `/api/buys/:id/cascade` deben estar cubiertos por un test de rutas HTTP, y el flujo completo por un e2e.

### S11 — Un 409 sin `associated_sales` no puede fallar en silencio (H2, review)

`isDeleteBuy409` solo miraba `status === 409`: si el body no traía `associated_sales`, la modal no abría y **no se mostraba ningún error** (el click en "Eliminar" no hacía nada). El guard debe exigir `associated_sales` no vacío; si no lo hay, la UI muestra el mensaje de error del server.

### S12 — Tracking ODD del trabajo in-flight (H3, review)

El batch estaba sin feature doc, sin `Log` y sin commits. Este documento es la spec del batch: los commits van en work units revisables sobre la branch `feature/delete-cascade-and-ux-polish`.

### S13 — Higiene del borrado irreversible (H4, review)

- El archivo de hook debe terminar con newline.
- El borrado en cascada deja **audit trail**: el server lo registra (Pino) con el id de compra y las ventas afectadas, porque la acción no tiene undo.
- "Sin undo" queda documentado como limitación conocida (la modal ya lo dice: "Esta acción no se puede deshacer.").

## Tasks

| ID  | Título                                                                              | Specs         | Ruta                                                                                  | Commit |
| --- | ----------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------- | ------ |
| T1  | Feature doc + mirror Engram + tracking `todo`                                        | S12           | `odd/tasks/feature-delete-cascade-and-ux-polish.md`                                   | WU0    |
| T2  | Repo: `remove` discriminado + `removeWithCascade` + `listAssociatedSales`            | S1, S2        | `server/src/repo/buys-repo.ts`                                                        | WU1    |
| T3  | Ruta: 409 + `/:id/cascade` + audit log Pino                                         | S1, S2, S13   | `server/src/routes/buys.ts`                                                           | WU1    |
| T4  | Tests de repo + **tests de rutas HTTP** (409, cascade, path cascade, 404)              | S1, S2, S10   | `server/src/__tests__/buys.test.ts`, `server/src/__tests__/buys-routes.test.ts`        | WU1    |
| T5  | Web: guard 409 estricto + fallback al error del server                              | S2, S11       | `web/src/hooks/useDeleteBuy.ts`, `web/src/pages/buys/BuyEditPage.tsx`                 | WU2    |
| T6  | Web: test del guard (RED → GREEN)                                                    | S11           | `web/src/hooks/__tests__/useDeleteBuy.test.tsx`                                       | WU2    |
| T7  | E2E: flujo 409 → modal → cascade                                                     | S1, S2, S10   | `web/e2e/buys-and-solds-flow.spec.ts`                                                 | WU3    |
| T8  | Web: items en `/solds` + `times_sold` + literales/color de KPI                       | S3, S4, S5    | `server/src/repo/solds-repo.ts`, `server/src/__tests__/solds.test.ts`, `web/src/api/solds.ts`, `web/src/pages/solds/SoldsListPage.tsx`, `web/src/pages/dashboard/OverviewTab.tsx`, `server/src/__tests__/stats-dashboard.test.ts` | WU4 |
| T9  | Web: nombre sin link + sort idle + view transitions + blur del autocomplete          | S6, S7, S8, S9 | `web/src/pages/buys/BuysListPage.tsx`, `web/src/pages/solds/SoldsListPage.tsx`, `web/src/pages/buys/BuyEditPage.tsx`, `web/src/pages/solds/SoldEditPage.tsx`, `web/src/components/layout/Layout.tsx`, `web/src/components/sales/CustomerAutocomplete.tsx`, `web/src/components/sales/__tests__/CustomerAutocomplete.test.tsx`, `web/src/pages/dashboard/DashboardPage.tsx` | WU5 |
| T10 | Docs: `AGENTS.md` §12/§13 + README + Log L1                                         | S12           | `AGENTS.md`, `README.md`, este doc                                                    | WU6    |
| T11 | Native review del WU1 commiteado (item 1 → high risk)                                | S1, S2        | —                                                                                     | WU1    |
| T12 | Push a `origin/master`                                                               | —             | —                                                                                     | —      |

**Work units**:

- **WU0** — tracking (doc + mirror + todo). Sin código.
- **WU1** — server: repo + rutas + tests. `Risk: item 1` (borra ventas de forma irreversible) → commit propio para que la native review lo tome sola.
- **WU2** — web: guard estricto + test del guard.
- **WU3** — e2e del flujo completo.
- **WU4** — `/solds` con items + `times_sold` + KPI.
- **WU5** — UX de navegación.
- **WU6** — docs.

## Log

- **L1 (2026-10-19, request original del usuario)**:

  > "1- si quieres eliminar una compra de la cual ya has vendido te da un error 500, podria dar un msg mas descriptivo o dar opcion a eliminar la/las ventas asociada
  > 2- quiero que ne dasboard 'Compras totales' salga en un rojo clarito y 'Ventas totales' un verde clarito
  > 3- voy a cmabiar un par de literales, dejalos asi
  > 4- en top 5 productos hay que reinterpretarlo, compre 10 sobres y vendi 2, `pero en 'Top 5 productos' sale sobre 4€ 1x, deberia salir 2x poerque vendi 2 sobres. Sin embargo 'Top 5 compradores' esta perfecto, no lo toques"

- **L2 (2026-10-19, item 1 — borrado de compras — aprobado por el usuario como diseño híbrido 409 + cascade)**: quote literal en S2. El worker tenía prohibido tocar literales y commitear.
- **L3 (2026-10-19, review del estado del proyecto)**: se detectó que el batch estaba sin commitear, sin feature doc y con 3 huecos de calidad → de ahí salen S10, S11, S13. Pedido del usuario: "arregla los '### 4. Hallazgos de mi review'".
- **L4 (2026-10-19, evidencia)**: verificación de partida del batch in-flight — typecheck ✅, lint ✅, 124 tests server + 72 web ✅, 14/14 e2e ✅. `npm run format:check` rojo desde antes (64 archivos, 46 sin tocar) → no es gate del repo.
- **L5 (2026-10-19, decisión)**: el cascade se documenta como **sin undo** y con audit trail en el log del server (S13). No se implementa undo ni soft-delete: la app es local y el usuario pidió el borrado explícito.
- **L6 (2026-10-19, descubrimiento al validar el test de rutas)**: el comentario original del código ("`/:id/cascade` va antes de `/:id` ... Express intentaría matchear `/5/cascade` con id='5/cascade'") era **falso**: en Express 5 (path-to-regexp v8) el parámetro `:id` matchea `[^/]+`, o sea que nunca matchea un path de dos segmentos. Se verificó por mutación: registrando `/:id` **antes** de `/:id/cascade` los 10 tests siguen verdes. El riesgo real no era el orden de rutas sino la forma del path. Se corrigió el comentario del código y se reformuló el test. Ojo distinto: el orden de `/stock` antes de `/:id` **sí** importa (mismo segmento, "stock" no es numérico) y ese comentario queda como estaba.
- **L7 (2026-10-19, evidencia de que los tests muerden)**: mutación controlada sobre el test nuevo (`server/src/__tests__/buys-routes.test.ts`): (a) sacar `associated_sales` del body del 409 → 2 tests rojo; (b) hacer que `remove` ignore las ventas asociadas → 2 tests rojo; (c) hacer que la cascada borre la venta entera aunque tenga otros items → 1 test rojo. En el e2e: hacer que el 409 borre en silencio → el e2e falla al no encontrar la modal. Restaurado, todo verde.
- **L8 (2026-10-19, commits del feature)**: el trabajo quedó en 5 work units sobre `feature/delete-cascade-and-ux-polish` (desde `master` en 01a3565):

  | Commit | Work unit | Contenido | Líneas |
  | --- | --- | --- | --- |
  | `658d5cf` | WU1 | server: `remove` discriminado + `removeWithCascade` + ruta 409 + ruta cascade + audit log + tests de repo y de rutas HTTP | ~707 |
  | `53ace1b` | WU2 | web: modal de cascada + `useDeleteBuyCascade` + guard 409 estricto + test del guard | ~346 |
  | `ea2c332` | WU3 | e2e: flujo 409 → modal → cascade (+ cash-flow con ventas negativas) | ~84 |
  | `f0288ea` | WU4 | server+web: columna "Productos" en `/solds` + `times_sold` por unidades | ~177 |
  | `24b3777` | WU5 | web: view transitions, sort idle, nombre sin link, blur del autocomplete, KPI | ~89 |
  | (este)   | WU6 | docs: feature doc + `AGENTS.md` §12/§13 + README | ~120 |

  **Frontera de slice**: el objetivo eran slices de ~400 líneas. WU1 se pasó (707) porque el server y sus tests son **una sola unidad de comportamiento** (tests + código de la misma regla van juntos, no se separan), y el riesgo (`Risk: item 1`) exige que ese commit vaya solo para que la native review lo tome sin ruido. Los commits WU2-WU6 quedan todos por debajo de 400.
- **L9 (2026-10-19, actor concurrente)**: durante el cierre, otro actor editaba en paralelo `web/src/pages/dashboard/DashboardPage.tsx` (spacing de las tabs: `px-1` → `px-12` → `px-8`, y `gap-6` → sin gap) y `web/src/components/layout/NavLink.tsx` (contraste del nav en dark: `dark:bg-brand-900/40` → `dark:bg-brand-400/40`). **Esos dos archivos quedan sin commitear a propósito**: no son parte de este feature y el tweak estaba en movimiento mientras se commiteaba. El `viewTransition` de la tab del dashboard sí forma parte de S8 y ya está en el working tree (queda en el diff del actor).
