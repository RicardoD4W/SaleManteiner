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
