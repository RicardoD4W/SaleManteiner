# Feature: toasts con sileo para crear, editar y borrar compras, ventas y clientes

Añade confirmaciones por toast a las acciones de compras, ventas y clientes usando la librería **sileo**. Es la pieza base de la que dependen el resto de specs del batch (las confirmaciones de borrado en las tablas y la vista de Clientes).

**Riesgo del feature**: ninguno (no cambia datos ni contratos) → `Risk: none`.

## Specs

### S1 — Toasts de confirmación en las acciones de compras, ventas y clientes

> "6. agregar confirmaciones por toast de edicion, eliminacion y registro de compras, ventas y clientes usanbdo la libreria sileo (busca su documentacion para ver como funciona)"

Regla: cada alta, edición y borrado **exitoso** de una compra, una venta o un cliente dispara un toast. Los **errores no se toastean**: ya se muestran en línea en los formularios y en las modales de borrado, y un toast con el mismo mensaje sería duplicarlo (decisión en L6).

API de sileo (verificada en la documentación oficial, `sileo` v0.1.6, MIT):

```tsx
import { sileo, Toaster } from 'sileo';

sileo.success({ title, description, position, duration, fill, styles });
sileo.error({ title, description });
sileo.warning({ title, description });
sileo.info({ title, description });
sileo.promise(promesa, { success, error });
```

- `SileoOptions`: `title` (string), `description` (ReactNode | string), `position` (default del Toaster), `duration` (ms, default 6000, `null` = pegajoso), `icon` (ReactNode), `fill` (color de fondo del SVG, default `#FFFFFF`), `styles` (overrides por sub-elemento), `roundness` (px, default 16), `autopilot`, `button`.
- `<Toaster position="top-right" theme="light|dark" offset options />` se monta **una sola vez** en el layout raíz.
- sileo depende de `motion` (peer dep) y usa morphing SVG + física de resorte: no hay CSS propio que escribir.

### S2 — El toast tiene que verse bien en dark mode

Regla: en dark mode el toast no puede quedar con el fondo blanco por defecto (`fill: "#FFFFFF"`). Se invierte el `theme` que se le pasa a sileo (ver L7: sileo nombra el tema al revés) y se baja el toast con `offset` para que no tape el nav del header.

OJO con el `theme` de sileo: su `THEME_FILLS` es `{ light: '#1a1a1a', dark: '#f2f2f2' }` y el color del texto sigue al tema (con "light" la descripción sale blanca, con "dark" sale oscura). Es decir: el tema "light" de sileo es la tarjeta **oscura**. Para que el toast se parezca a la app hay que invertir: en dark mode de la app se le pasa `theme="light"` a sileo.

### S3 — Dónde se monta el `Toaster` y dónde se disparan los toasts

Regla:

- `<Toaster />` va en el layout raíz de la app (junto al `Outlet` / el `Layout`), **una sola vez** para toda la app.
- Los toasts se disparan desde los hooks de mutación (`useCreateBuy`, `useUpdateBuy`, `useDeleteBuy`, `useCreateSold`, `useUpdateSold`, `useDeleteSold`, `useCreateCustomer` + los de update/delete de clientes que se creen en el feature de Clientes) o desde la capa que los usa, **no** desde los componentes de página: así cualquier pantalla que use el hook obtiene el mismo aviso.
- El toast **no** bloquea: el `onSuccess` de la mutación sigue cerrando la modal / navegando como hasta ahora.

Literales de los toasts (propuestos, a confirmar por el usuario en la implementación):

| Acción          | Toast                         |
| --------------- | ----------------------------- |
| Compra creada   | title `"Compra registrada"`   |
| Compra editada  | title `"Compra actualizada"`  |
| Compra borrada  | title `"Compra eliminada"`    |
| Venta creada    | title `"Venta registrada"`    |
| Venta editada   | title `"Venta actualizada"`   |
| Venta borrada   | title `"Venta eliminada"`     |
| Cliente creado  | title `"Cliente registrado"`  |
| Cliente editado | title `"Cliente actualizado"` |
| Cliente borrado | title `"Cliente eliminado"`   |

En todos, la `description` lleva el nombre del registro (el producto, el cliente). Los errores usan `sileo.error` con el mensaje del server tal cual (`ApiError.body.error`).

## Tasks

| ID  | Título                                                | Specs  | Ruta                                                                                                 | Commit |
| --- | ----------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- | ------ |
| T1  | Dependencia `sileo` + `<Toaster />` en el layout raíz | S1, S2 | `web/package.json`, `package-lock.json`, `web/src/main.tsx` o `web/src/components/layout/Layout.tsx` | WU1    |
| T2  | Helper único de toasts (éxito/error por acción)       | S1, S3 | `web/src/lib/toast.ts` (nuevo)                                                                       | WU1    |
| T3  | Toasts en las mutaciones de compras y ventas          | S1, S3 | `web/src/hooks/use{Create,Update,Delete}Buy.ts`, `web/src/hooks/use{Create,Update,Delete}Sold.ts`    | WU2    |
| T4  | Test de los toasts (RED → GREEN) con el helper        | S1     | `web/src/lib/__tests__/toast.test.ts` (nuevo) o `web/src/hooks/__tests__/*`                          | WU2    |
| T5  | Verificación en light y dark (captura)                | S2     | —                                                                                                    | WU2    |
| T6  | Push a `origin/master`                                | —      | —                                                                                                    | —      |

**Work units**:

- **WU1** — dependencia + `Toaster` + helper de toasts.
- **WU2** — disparo de los toasts en las mutaciones + tests.

Dependencias: este feature es la base de `feature-acciones-en-listas` (los avisos de borrado en las tablas) y de `feature-clientes-crud` (los avisos de alta/edición/borrado de clientes).

## Log

- **L1 (2026-10-20, request original del usuario)**:

  > "vamos a dejar spècs preparados para trabajar en ellos, no los vamos a hacer ahora.
  >
  > 1. tabla de /solds cuando hago click en 'Asociados' el incono del filtro '▼' se baja en dos lineas en vez de quedarse en una.
  > 2. En '/solds', si creo una nueva venta, elijo un producto con varias unidades disponibles pero solo escojo 1, me arrepiento y le doy a '+Cambiar productos' hay varios fallos:
  >    2.1. No está preseleccionado el que habías seleccionado antes
  >    2.2. Si seleccionas el mismo pero añades más unidades, en la modal de 'Nueva venta' se ve reflejado como si hubieras elegido solo una unidad
  >    2.3. Si cuando voy a seleccionar un producto del cual tenemos 15 unidades, en el input number pongo un 2, se pone un 12 y no me deja poner 2 a no ser que seleccione todo, ¿podemos arreglar eso de alguna manera àra mejorar la UX?
  >    2.4. Si cuando le doy a '+Cambiar productos' le doy a Cancelar, deberia ir a la modal de 'Nueva venta' manteniendo la info anterior, sin embargo, actualmente cancela toda la venta.
  > 3. Quiero que tanto en /solds como en /buys cuando alguiewn edite un registro preexistente, haya una view transition que relacione la informacion que ya exista hacia la nueva vista.
  > 4. Quiero añadiren el header una vista más que sea 'Clientes' para poder registrar eliminar o modificar los clientes, Recuerda que si eliminas un cliente con compras asociadas sus compras tmb se borraran
  > 5. hacer boton borrar en tabla de compra y ventas y quitar el boton borrar del apartado de editar, mantener la confirmacion de borrado en uan modal y mantener la doble confirmacion cuando borramos una compra que tiene ventas asociadas para eliminar en cascada
  > 6. agregar confirmaciones por toast de edicion, eliminacion y registro de compras, ventas y clientes usanbdo la libreria sileo (busca su documentacion para ver como funciona)"

- **L2 (2026-10-20, evidencia — librería sileo)**: la librería existe y es la indicada: `sileo` v0.1.6 (MIT, ~1.6k estrellas, ~68k descargas/semana), en https://sileo.aaryan.design/docs. Instalar con `npm i sileo`. API verificada: `sileo.success/error/warning/info/action/show/promise/dismiss/clear`, opciones `title`, `description`, `position`, `duration` (default 6000, `null` = pegajoso), `icon`, `fill` (default `#FFFFFF`), `styles`, `roundness`, `autopilot`, `button`; `<Toaster position="top-right" theme offset options />` para el montaje. Depende de `motion` (peer dependency).
- **L3 (2026-10-20, evidencia — hooks de mutación que hay que hookear)**: `useCreateBuy`, `useUpdateBuy`, `useDeleteBuy`, `useDeleteBuyCascade`, `useCreateSold`, `useUpdateSold`, `useDeleteSold` (todas con `qc.invalidateQueries` en el `onSuccess`) y `useCreateCustomer`. Los de update/delete de clientes todavía no existen: los crea `feature-clientes-crud`.
- **L4 (2026-10-20, decisión)**: los errores de validación en línea de los formularios (Zod + `setError`) **se quedan**; el toast es solo para el resultado de la acción (éxito/fracaso). Así no se duplica el mensaje ni se pierde el foco en el campo con error.
- **L5 (2026-10-20, decisión)**: el toast se dispara desde los hooks de mutación y no desde las páginas, para que el mismo hook usado en cualquier pantalla dé el mismo aviso. Si un flujo necesita un texto distinto (p. ej. el borrado en cascada de una compra), el hook recibe el texto por parámetro opcional.
- **L6 (2026-10-20, decisión — los errores NO se toastean)**: los errores ya se muestran en línea (el `setError` de los formularios y el `setDeleteError` de las páginas de edición). Un toast con el mismo mensaje sería duplicarlo, así que el toast es solo de confirmación de éxito. Se cambió el S1 en consecuencia.
- **L7 (2026-10-20, evidencia — sileo invierte el nombre del tema)**: en `sileo@0.1.6`, `THEME_FILLS = { light: '#1a1a1a', dark: '#f2f2f2' }` y el color del texto sigue al tema (`[data-sileo-viewport][data-theme="light"] [data-sileo-description] { color: rgba(255,255,255,.5) }`). O sea: el tema "light" de sileo es la tarjeta **oscura**. Para que el toast acompañe al dark mode de la app hay que invertir la correspondencia.
- **L8 (2026-10-20, implementación)**: `<Toaster>` se monta una vez en la raíz (`main.tsx`, fuera del router, para que los toasts sobrevivan a la navegación). El tema se lee del DOM con el hook nuevo `useDomTheme` (un `MutationObserver` sobre la clase `dark` del `<html>`): el `useTheme` de la app es estado local por componente, así que el Toaster no puede leerlo sin desincronizarse. Dos ajustes de la librería: `offset={{ top: '4rem' }}` (el toast tapaba el nav del header) y `styles: { title: 'normal-case!' }` (sileo aplica `text-transform: capitalize` al título: "Compra Registrada" no es español).
