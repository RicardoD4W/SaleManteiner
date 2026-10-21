# Feature: vista de Clientes (alta, edición y borrado en cascada)

Añade una vista "Clientes" al header para registrar, editar y eliminar clientes. Al borrar un cliente con ventas asociadas, sus ventas se borran también (y hay que avisarlo antes).

**Riesgo del feature**: item 1 (data / efectos irreversibles) — borrar un cliente borra sus ventas (y sus `sale_items`) de forma permanente.

## Specs

### S1 — Vista "Clientes" en el header

> "4. Quiero añadiren el header una vista más que sea 'Clientes' para poder registrar eliminar o modificar los clientes, Recuerda que si eliminas un cliente con compras asociadas sus compras tmb se borraran"

Regla: el header suma una cuarta entrada, "Clientes", con la misma navegación que las otras (react-router + `viewTransition`):

```text
Dashboard · Compras · Ventas · Clientes
```

La vista (`/customers`) lista los clientes con: nombre, número de ventas, total gastado y acciones (editar, eliminar). Tiene un botón "Nuevo cliente" que abre un modal de alta con el mismo campo que usa el `CustomerAutocomplete` (el nombre).

La API de clientes ya existe completa (`GET/POST/PATCH/DELETE /api/customers` + `GET /api/customers?q=`): lo que falta es la capa web (la vista, los hooks de update/delete y el cliente de API si falta algo).

### S2 — Editar un cliente

Regla: desde la vista de Clientes se puede editar el nombre de un cliente. El `PATCH /api/customers/:id` ya existe ✔.

Los clientes ya usados en ventas: cambiarles el nombre actualiza la vista de ventas (el nombre se resuelve por id en el cliente) ✔ — no hay que tocar las ventas.

### S3 — Borrar un cliente borra también sus ventas, con confirmación explícita

Regla: borrar un cliente con ventas asociadas **borra esas ventas** (y sus `sale_items`). Hoy el esquema tiene `solds.customer_id ... ON DELETE RESTRICT`, así que el borrado falla y la ruta no captura el error de FK.

Diseño propuesto (el mismo patrón que ya usa el borrado de compras, para que el usuario no aprenda dos reglas):

- `DELETE /api/customers/:id` con ventas asociadas → **409** con `{ error, associated_sales: [{ id, customer_name, sold_at, items_count }] }` (la lista de las ventas que se van a borrar).
- `DELETE /api/customers/:id/cascade` → borra el cliente **y** sus ventas (con sus `sale_items`), en una transacción. 204 si OK, 404 si el cliente no existe.
- La UI: al recibir el 409 abre un modal que **nombra** las ventas afectadas y pide confirmación explícita ("Borrar también las ventas y el cliente"); el botón llama al endpoint cascade. Doble confirmación: el modal es la confirmación.

Criterio de aceptación: borrar un cliente sin ventas → 204 y desaparece de la lista; con ventas → 409 con la lista, y el cascade borra cliente + ventas + items (verificable en la vista de Ventas).

### S4 — Avisos de toast (depende de `feature-toasts-sileo`)

Regla: alta, edición y borrado de clientes disparan toast ✔ (ver `feature-toasts-sileo`, S1).

## Tasks

| ID  | Título                                                               | Specs  | Ruta                                                                                                                   | Commit |
| --- | -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| T1  | Ruta + entrada "Clientes" en el header                               | S1     | `web/src/App.tsx`, `web/src/components/layout/Layout.tsx`                                                              | WU1    |
| T2  | Vista de Clientes: tabla + alta + edición + acciones                 | S1, S2 | `web/src/pages/customers/CustomersListPage.tsx` (nuevo)                                                                | WU1    |
| T3  | Hooks de update/delete de cliente + cliente de API si falta          | S2     | `web/src/hooks/useUpdateCustomer.ts` (nuevo), `web/src/hooks/useDeleteCustomer.ts` (nuevo), `web/src/api/customers.ts` | WU1    |
| T4  | Modal de alta/edición de cliente                                     | S1, S2 | `web/src/components/sales/CustomerFormModal.tsx` (nuevo)                                                               | WU1    |
| T5  | Server: repo con borrado en cascada (transaccional) + audit log      | S3     | `server/src/repo/customers-repo.ts`                                                                                    | WU2    |
| T6  | Server: ruta 409 + `/:id/cascade`                                    | S3     | `server/src/routes/customers.ts`                                                                                       | WU2    |
| T7  | Tests de repo y de rutas HTTP (409, cascade, 404, 400)               | S3     | `server/src/__tests__/customers.test.ts`, `server/src/__tests__/customers-routes.test.ts` (nuevo)                      | WU2    |
| T8  | Web: guard del 409 + modal de confirmación de cascada                | S3     | `web/src/hooks/useDeleteCustomer.ts`, `web/src/components/sales/DeleteCustomerModal.tsx` (nuevo)                       | WU3    |
| T9  | E2E: crear cliente → vender → borrar cliente (409 → modal → cascade) | S1, S3 | `web/e2e/clientes-flow.spec.ts` (nuevo)                                                                                | WU4    |
| T10 | Toasts de clientes                                                   | S4     | `web/src/hooks/use{Create,Update,Delete}Customer.ts`                                                                   | WU5    |
| T11 | Docs: AGENTS.md (nueva vista) + README                               | S1     | `AGENTS.md`, `README.md`                                                                                               | WU6    |
| T12 | Push a `origin/master`                                               | —      | —                                                                                                                      | —      |

**Work units**:

- **WU1** — la vista de Clientes (web, sin tocar el server).
- **WU2** — server: el borrado en cascada. `Risk: item 1` (borra ventas de forma irreversible) → commit propio para que la native review lo tome sola.
- **WU3** — web: el guard del 409 + la modal de cascada.
- **WU4** — e2e del flujo completo.
- **WU5** — toasts (depende de `feature-toasts-sileo`).
- **WU6** — docs.

## Log

- **L1 (2026-10-20, request original del usuario)**:

  > "4. Quiero añadiren el header una vista más que sea 'Clientes' para poder registrar eliminar o modificar los clientes, Recuerda que si eliminas un cliente con compras asociadas sus compras tmb se borraran"

- **L2 (2026-10-20, evidencia — la API de clientes ya está completa)**: `server/src/routes/customers.ts` tiene `GET /`, `GET /:id`(?), `GET /?q=`(búsqueda), `POST /`, `PATCH /:id` y `DELETE /:id`. Del lado web, `web/src/api/customers.ts` tiene `list`, `getById`, `search`, `create`, `update` y `remove` ✔. Falta la vista y los hooks de update/delete.
- **L3 (2026-10-20, evidencia — hoy el borrado de un cliente con ventas rompe)**: el esquema tiene `customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT` (migración 003) y `customers-repo.remove` hace un `DELETE FROM customers WHERE id = ?` sin capturar el error de FK; la ruta tampoco lo captura → el borrado de un cliente con ventas deja la base en un error de FK (el mismo problema que tuvo el borrado de compras y que se resolvió con el 409 + cascade).
- **L4 (2026-10-20, decisión — el patrón 409 + cascade)**: se replica el diseño que ya existe para el borrado de compras (409 explicativo + endpoint cascade + doble confirmación), en vez de un borrado silencioso en cascada. El usuarioavisó de que las ventas se borran; con este diseño se borran **previa confirmación** ✔, que es lo que ya conoce.
- **L5 (2026-10-20, decisión — la ruta es `/customers`)**: la app usa rutas en inglés (`/buys`, `/solds`, `/revenue`, `/products`, `/buyers`) ✔ → `/customers` y no `/clientes`. El texto de la interfaz va en español ("Clientes") ✔.
- **L6 (2026-10-20, decisión — el nombre del cliente no toca las ventas)**: el nombre se resuelve por id en el cliente (`customerName` en la página de ventas) ✔, así que renombrar un cliente no requiere tocar sus ventas.
- **L7 (2026-10-21, WU2 — server: 409 + cascade, commit `a229f5f`)**: el borrado en cascada de clientes en el server.
  - **Antes**: `DELETE /api/customers/:id` con ventas asociadas dejaba la base en un error de FK (`solds.customer_id` es `ON DELETE RESTRICT`) y la ruta no lo capturaba → un 500 sin explicación (confirmaba L3).
  - **Ahora**: `remove` del repo pasa a discriminado (`ok | NOT_FOUND | HAS_ASSOCIATED_SALES`); la ruta mapea a 409 con `{ error, associated_sales: [{ id, customer_name, sold_at, items_count }] }` (y NO borra nada), 204 si no hay ventas, 404 si el cliente no existe. El borrado real va por `DELETE /api/customers/:id/cascade`, que borra cliente + ventas + `sale_items` de esas ventas **en una transacción** (si algo falla, no queda nada a medias). 204 ok, 404 si no existe.
  - **Audit trail write-ahead**: la cascada no tiene undo → se registra la intención ANTES de borrar (cliente + ventas afectadas) y, si falla, queda registrado que no se completó. Si el cliente no existe no se loguea nada (no hay borrado que registrar).
  - **Decisiones que no estaban en el doc**: (1) `items_count` es el total de **unidades** de la venta (`SUM(sale_items.quantity)`), la misma semántica que el 409 de compras; (2) la cascada **no borra las compras**: solo cliente + ventas + sus items (las compras quedan intactas); (3) el mensaje del 409 replica el de compras para que el usuario no aprenda dos reglas.
  - **Tests**: 11 de repo (incluido el rollback) + 18 de rutas HTTP por HTTP real (204, 409 con una y con varias ventas, que no se borra nada, cascade, 404, 400, que `/:id/cascade` no se interprete como un id, el audit trail y su write-ahead). Verificado: typecheck ✔, lint ✔, 174 tests del server ✔.
- **L8 (2026-10-21, WU1 — web: la vista de Clientes, commit `24aeca6`)**: la cuarta entrada del header ("Clientes", ruta `/customers`) con la lista, el alta y la edición.
  - **Métricas calculadas en el cliente**: no hay endpoint que dé "nº de ventas" ni "total gastado" por cliente, y `topBuyers` del dashboard está limitado a `LIMIT 10` (daría datos incompletos) → la vista cruza `useSolds()` con `useCustomers()` y suma con `round2()`. Con ~50 ventas/mes el payload es despreciable.
  - **Tabla semántica simple, no la `VirtualTable`**: `VirtualTable` (TanStack Virtual) no renderiza filas en jsdom (rompió los tests de página) y la lista de clientes es corta. Se usa el patrón de tabla de `BuyersTab` (cabeceras con `tableHeadClass` + `useSortable` de 3 estados).
  - **Modal de alta/edición** (`CustomerFormModal`) validado con los schemas Zod que ya existen (`CreateCustomerInput` / `UpdateCustomerInput`), con focus trap, Escape/backdrop, foco al campo al abrir y devuelto al disparador al cerrar, y los errores con `role="alert"`.
  - **`useUpdateCustomer` invalida** `['customers']` y `['stats','dashboard']` (topBuyers muestra el nombre del cliente). **No dispara toast todavía**: los toasts de clientes son el WU5 de este feature.
  - **Sin acción de borrar**: el borrado en cascada (web) es el WU3 de este feature.
  - **Corrección del review del padre**: el botón "Editar" de cada fila llevaba el nombre accesible "Editar" a secas (hay uno por fila) → ahora es `aria-label="Editar <nombre del cliente>"`. También se corrigió un comentario que decía que el server devuelve los clientes en `id DESC` (los devuelve por nombre, `COLLATE NOCASE`).
  - **Tests**: 17 nuevos (4 del hook, 8 del modal, 5 de la página). Verificado: typecheck ✔, lint ✔, prettier ✔, tests del web verdes.
- **L9 (2026-10-21, WU3 + WU5 — commit `10667b7`)**: la parte web del borrado en cascada y los toasts de clientes.
  - **Qué quedó**: `useDeleteCustomer` (con el guard estricto `isDeleteCustomer409`), `useDeleteCustomerCascade`, `customersApi.removeCascade`, la modal de cascada del cliente y el botón "Borrar" en la vista (con `aria-label="Borrar <nombre>"`). El flujo es el mismo de las compras: confirmación simple → (409) → cascada, con las modales a nivel de página.
  - **El guard del 409 es estricto** (misma lección que S11): un 409 sin `associated_sales` (o con la lista vacía) NO entra en la cascada: cae en el mensaje del server dentro de la modal de confirmación. Si el guard fuera laxo, el click en "Borrar" no haría nada.
  - **Toasts (S4)**: la edición avisa "Cliente actualizado" (con el nombre) y el borrado "Cliente eliminado". El alta ya tenía su toast y NO se duplicó. Los errores no se toastean.
  - **Decisión**: el toast de la edición lleva el nombre del cliente (como el del alta); los de borrado no lo llevan, como los de compras y ventas del repo.
  - **Consolidación**: `DeleteCustomerModal` había salido como copia de `DeleteBuyModal` con otros textos. El markup vive ahora una sola vez en `DeleteCascadeModal` (nuevo) y los dos wrappers pasan las palabras ("La compra"/"El cliente", "la"/"lo"). De paso se corrigió un texto que se había quedado en "vos Tutundo": la cascada de compras decía "Si la borras" y ahora dice "Si la borrás", como el resto de la app.
- **L10 (2026-10-21, verificación independiente del server — commit `a229f5f` + `13f6619`)**: un verificador independiente (read-only, en un scratch) auditó la cascada de clientes en 6 dimensiones, todas **OK y sin bloqueantes**: atomicidad (con un trigger que aborta el ÚLTIMO delete, no solo el primero), el 409 no borra nada (SHA de la BD byte-idéntico tras 409/404/400), el guard estricto, el alcance (0 huérfanos, no toca ventas de otros clientes ni compras), el audit trail write-ahead (y sin log si no se borró nada) y el matching de rutas HTTP (`/:id/cascade` protegido del `/:id` con path-to-regexp v8).
  - **Dos de sus probes cubrían huecos reales** y quedaron como tests del repo (`13f6619`): la atomicidad del último paso del borrado y la ausencia de filas huérfanas.
  - **Advisories sin acción** (monousuario, app local): un TOCTOU entre el `getById` y el borrado en cascada (3 sentencias fuera de la transacción) y el payload de auditoría sin `sold_at` (igual que el de compras).
- **L11 (2026-10-21, e2e del flujo de clientes)**: `web/e2e/clientes-flow.spec.ts` (nuevo): alta desde la UI → edición → borrado simple, y el flujo con ventas (409 → modal de cascada → se borran cliente y venta y el stock se libera).
