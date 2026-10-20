# Feature: acciones en las tablas de listados (borrar en la tabla, view transitions al editar, indicador de orden)

Mueve el borrado a las tablas de `/buys` y `/solds`, añade una view transition que relacione la fila con la vista de edición y arregla el indicador de orden que se parte en dos líneas.

**Riesgo del feature**: item 1 (data / efectos irreversibles) — el borrado en cascada de una compra con ventas asociadas borra ventas de forma permanente.

## Specs

### S1 — Botón de borrar en las tablas y fuera de las páginas de edición

> "5. hacer boton borrar en tabla de compra y ventas y quitar el boton borrar del apartado de editar, mantener la confirmacion de borrado en uan modal y mantener la doble confirmacion cuando borramos una compra que tiene ventas asociadas para eliminar en cascada"

Regla:

- `/buys` y `/solds` suman una acción de **borrar** por fila (junto al "Editar" que ya hay en la columna "Acciones").
- Las páginas de edición (`/buys/:id`, `/solds/:id`) **quitan** el botón de borrar.
- El borrado **siempre** pasa por una modal de confirmación.
- La doble confirmación se mantiene: si la compra tiene ventas asociadas, el `DELETE` normal responde 409 y la modal lista las ventas afectadas y ofrece el borrado en cascada (el flujo que ya existe hoy en `BuyEditPage`).

Criterio de aceptación: desde la tabla se borra una compra y una venta con la misma modal (o el mismo par de modales para la cascada) que se usaba en la página de edición; la página de edición ya no borra.

### S2 — La confirmación de borrado es un componente compartido

Regla: la modal de confirmación de borrado y la de cascada se extraen de `BuyEditPage` a componentes compartidos (p. ej. `web/src/components/sales/DeleteBuyModal.tsx` y `web/src/components/ui/ConfirmDeleteModal.tsx`) para que la tabla y la página de edición usen **el mismo** diálogo, sin duplicar el texto.

El flujo de cascada que hay que conservar tal cual:

1. `DELETE /api/buys/:id` → 409 con `{ error, associated_sales: [...] }`.
2. Modal con el título "La compra tiene ventas asociadas" y el botón "Borrar también las ventas y la compra".
3. `DELETE /api/buys/:id/cascade` → borra la compra y limpia las ventas asociadas.

### S3 — View transition al editar un registro

> "3. Quiero que tanto en /solds como en /buys cuando alguiewn edite un registro preexistente, haya una view transition que relacione la informacion que ya exista hacia la nueva vista."

Regla: al ir de la tabla a la edición de un registro (o al volver), la transición **relaciona** la fila con la vista nueva: el nombre del producto (o del cliente / la fecha) viaja de la celda de la tabla al campo correspondiente del formulario, con la View Transitions API (`document.startViewTransition` + `view-transition-name`).

Los enlaces "Editar" de las tablas ya usan la `viewTransition` de react-router (una cross-fade genérica). Lo que se pide es una transición de **elemento compartido**, no un cross-fade.

Consideraciones:

- `view-transition-name` tiene que ser **único** en el documento: como las tablas son virtualizadas hay varias filas en el DOM, así que el nombre se asigna solo a la fila que se está por abrir (o se quita de las demás al hacer hover/click).
- El nombre del producto es la clave natural: la celda "Producto" de la fila ↔ el input de producto del formulario.
- Con el dark mode, la transición no debe dejar restos: hay que comprobar que el pseudo-elemento usa los colores del tema.

### S4 — El indicador de orden no se parte en dos líneas

> "1. tabla de /solds cuando hago click en 'Asociados' el incono del filtro '▼' se baja en dos lineas en vez de quedarse en una."

Regla: el indicador de orden (▲/▼) queda **en la misma línea** que el texto de la cabecera. Hoy la cabecera de las tabs del dashboard (y la de `/solds`) reserva el hueco con un `<span className="ml-1 inline-block w-3">`: en una columna estrecha (la de "Asociados (€)") el hueco no entra y el indicador baja a la línea siguiente.

Criterio de aceptación: al ordenar por "Asociados (€)" la cabecera sigue en una línea y la tabla no se desajusta (el ancho de las columnas no cambia al ordenar: eso ya está resuelto reservando el hueco del indicador).

## Tasks

| ID  | Título                                                                | Specs  | Route                                                                                                                                                        | Commit |
| --- | --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T1  | Extraer las modales de borrado a componentes compartidos              | S1, S2 | `web/src/components/sales/DeleteBuyModal.tsx` (nuevo), `web/src/components/ui/ConfirmDeleteModal.tsx` (nuevo)                                                | WU1    |
| T2  | Quitar el borrado de las páginas de edición                           | S1     | `web/src/pages/buys/BuyEditPage.tsx`, `web/src/pages/solds/SoldEditPage.tsx`                                                                                 | WU1    |
| T3  | Acción de borrar por fila en `/buys` (con el flujo de cascada)        | S1, S2 | `web/src/pages/buys/BuysListPage.tsx`, `web/src/components/ui/VirtualTable.tsx`                                                                              | WU2    |
| T4  | Acción de borrar por fila en `/solds`                                 | S1     | `web/src/pages/solds/SoldsListPage.tsx`, `web/src/components/ui/VirtualTable.tsx`                                                                            | WU2    |
| T5  | Test del flujo de borrado desde la tabla (incluye el 409 → cascada)   | S1, S2 | `web/src/components/sales/__tests__/` (nuevo) o `web/src/pages/buys/__tests__/` (nuevo)                                                                      | WU2    |
| T6  | Indicador de orden en una sola línea                                  | S4     | `web/src/components/ui/tableStyles.ts`, `web/src/pages/dashboard/ProductsTab.tsx`, `web/src/pages/dashboard/BuyersTab.tsx`                                   | WU3    |
| T7  | View transition de elemento compartido al editar                      | S3     | `web/src/pages/buys/BuysListPage.tsx`, `web/src/pages/solds/SoldsListPage.tsx`, `web/src/pages/buys/BuyEditPage.tsx`, `web/src/pages/solds/SoldEditPage.tsx` | WU4    |
| T8  | E2E: borrar desde la tabla (compra simple, compra con cascada, venta) | S1, S2 | `web/e2e/buys-and-solds-flow.spec.ts`                                                                                                                        | WU5    |
| T9  | E2E: la transición relate la fila con el formulario                   | S3     | `web/e2e/buys-and-solds-flow.spec.ts`                                                                                                                        | WU5    |
| T10 | Toasts de borrado                                                     | S1     | `web/src/hooks/useDeleteBuy.ts`, `web/src/hooks/useDeleteSold.ts`                                                                                            | WU6    |
| T11 | Push a `origin/master`                                                | —      | —                                                                                                                                                            | —      |

**Work units**:

- **WU1** — modales compartidas + quitar el borrado de las páginas de edición.
- **WU2** — el borrado desde las tablas. `Risk: item 1` (la cascada borra ventas) → commit propio.
- **WU3** — el indicador de orden en una línea.
- **WU4** — la view transition de elemento compartido.
- **WU5** — e2e.
- **WU6** — toasts (depende de `feature-toasts-sileo`).

Dependencias: los toasts (WU6) dependen de `feature-toasts-sileo`; el resto es independiente.

## Log

- **L1 (2026-10-20, request original del usuario)**:

  > "1. tabla de /solds cuando hago click en 'Asociados' el incono del filtro '▼' se baja en dos lineas en vez de quedarse en una.
  > ... 3. Quiero que tanto en /solds como en /buys cuando alguiewn edite un registro preexistente, haya una view transition que relacione la informacion que ya exista hacia la nueva vista.
  > ... 5. hacer boton borrar en tabla de compra y ventas y quitar el boton borrar del apartado de editar, mantener la confirmacion de borrado en uan modal y mantener la doble confirmacion cuando borramos una compra que tiene ventas asociadas para eliminar en cascada"

- **L2 (2026-10-20, evidencia — dónde vive hoy el borrado)**: `web/src/pages/buys/BuyEditPage.tsx` tiene el botón "Eliminar compra" (línea ~298), su modal de confirmación ("¿Eliminar "X"? No se puede deshacer.") y el flujo de cascada con el botón "Borrar también las ventas y la compra" (~línea 475). `web/src/pages/solds/SoldEditPage.tsx` tiene su equivalente para ventas. Las tablas (`BuysListPage`, `SoldsListPage`) solo ofrecen "Editar" en la columna "Acciones".
- **L3 (2026-10-20, evidencia — el indicador que se parte)**: el hueco del indicador se reserva con `<span className="ml-1 inline-block w-3">` en las cabeceras de las tabs del dashboard (`ProductsTab`, `BuyersTab`) y en la de las tablas virtualizadas (`VirtualTable`). Con una cabecera estrecha como "Asociados (€)" el hueco no entra y el indicador baja de línea. La reserva del hueco **no** se toca (es lo que evita que la tabla se desajuste al ordenar, ya corregido).
- **L4 (2026-10-20, evidencia — las transiciones de hoy)**: los "Editar" de las tablas usan la prop `viewTransition` de react-router (cross-fade genérica) ✔; el header también la usa en sus `NavLink`. Lo que falta es la transición de **elemento compartido** con `view-transition-name`.
- **L5 (2026-10-20, decisión — el borrado se saca de las páginas de edición)**: el usuario lo pide así ("quitar el boton borrar del apartado de editar"). Con eso, la página de edición deja de ser el lugar desde donde se borra y la tabla pasa a ser el único punto de borrado ✔ (las modales se comparten entre la tabla y, si hiciera falta, otras pantallas).
- **L6 (2026-10-20, decisión — el nombre del `view-transition-name`)**: se usa el nombre del producto como clave de la transición (celda "Producto" ↔ input del producto). Como las tablas están virtualizadas, el nombre se asigna a una sola fila a la vez (la que se va a abrir) para que el pseudo-elemento sea único ✔.
- **L7 (2026-10-20, riesgo)**: la virtualización y las view transitions interactúan: al hacer scroll, las filas se montan/desmontan, y un `view-transition-name` en una fila que se desmonta a mitad de la transición rompe la captura. El WU4 tiene que probarlo con la tabla virtualizada en `/buys` y `/solds` (no solo con una tabla estática).
