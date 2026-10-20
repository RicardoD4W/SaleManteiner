# Feature: UX de la modal de nueva venta (selección de productos)

Arregla los cuatro fallos que el usuario encontró al crear una venta con un producto de varias unidades y usar "+Cambiar productos".

**Riesgo del feature**: ninguno (no cambia datos ni contratos de API) → `Risk: none`.

## Specs

### S1 — "+Cambiar productos" abre el picker con lo ya elegido preseleccionado

> "2.1. No está preseleccionado el que habías seleccionado antes"

Regla: al volver a abrir el `ProductPickerModal` desde la modal de "Nueva venta", los productos ya confirmados aparecen **tildados** y con su cantidad actual, y las cantidades quedan editables sin volver a tildarlos.

Hoy el picker no tiene forma de recibir la selección previa: `ProductPickerModal` inicializa `checked` y `quantities` en `{}` y en su `useEffect` de apertura hace `setChecked({}); setQuantities({})` ("Reset al abrir"). La selección previa vive en el padre (`SaleNewModal` → `selectedItems`).

Criterio de aceptación: `ProductPickerModal` recibe la selección inicial (prop nueva) y la aplica al abrir; el `reset` a vacío se conserva solo para cuando no se pase ninguna selección inicial.

### S2 — Si vuelves a elegir el mismo producto con más unidades, la modal de venta lo refleja

> "2.2. Si seleccionas el mismo pero añades más unidades, en la modal de 'Nueva venta' se ve reflejado como si hubieras elegido solo una unidad"

Regla: tras confirmar el picker, la lista de items de la modal de "Nueva venta" muestra la **cantidad final** de cada producto (la que quedó en el picker), no la anterior ni un 1 por defecto.

Sospechosos a verificar en la implementación (el bug no está diagnosticado todavía):

- `ProductPickerModal.handleToggle`: al tildar pone la cantidad en 1 (`setQuantities((q) => ({ ...q, [id]: 1 }))`), así que si el producto ya estaba tildado con 2 y se vuelve a tocar, la cantidad vuelve a 1.
- `SaleNewModal.handlePickerConfirm`: el merge con `selectedItems` (`itemMap`) y el `setValue('items', ...)` del form.

Criterio de aceptación: un test que reproduzca el flujo (elegir 1 → "+Cambiar productos" → marcar 2 → confirmar) deja la modal de venta con 2 unidades del producto.

### S3 — El input de cantidad se puede escribir sin seleccionar todo

> "2.3. Si cuando voy a seleccionar un producto del cual tenemos 15 unidades, en el input number pongo un 2, se pone un 12 y no me deja poner 2 a no ser que seleccione todo, ¿podemos arreglar eso de alguna manera àra mejorar la UX?"

Regla: al escribir la cantidad de un producto, el valor nuevo **reemplaza** al anterior en lugar de concatenarse. Hoy el input es `type="number"` con `value={quantity}` (por defecto 1) y el cursor queda al final: escribir "2" produce "12" (y `Math.min(item.disponibles, ...)` lo recorta al máximo disponible).

Criterio de aceptación: con 15 unidades disponibles, escribir "2" deja el input en 2 sin necesidad de seleccionar el texto previo. Opciones válidas: seleccionar el contenido del input al enfocarlo (`onFocus` → `select()`), o tratar la escritura como un valor nuevo (input de texto con filtro numérico en vez de `type="number"`).

El input sigue respetando `min`/`max`: no se puede pasar de las unidades disponibles ni bajar de 1.

### S4 — Cancelar el picker vuelve a la modal de venta, no la cierra

> "2.4. Si cuando le doy a '+Cambiar productos' le doy a Cancelar, deberia ir a la modal de 'Nueva venta' manteniendo la info anterior, sin embargo, actualmente cancela toda la venta."

Regla: el botón "Cancelar" del `ProductPickerModal` (y el Escape / el click fuera del diálogo) **vuelven a la modal de "Nueva venta"** con los items, el cliente y los importes que ya había, sin tocar nada. Solo el cierre de la modal de venta (su "Cancelar" o el backdrop) descarta la venta entera.

Hoy el `onClose` del picker dentro de `SaleNewModal` llama a `onClose()` del padre → cancela todo el flujo.

Criterio de aceptación: abrir "+Cambiar productos" y cancelar conserva la venta tal como estaba (items, cliente, precio).

## Tasks

| ID  | Título                                                                     | Specs  | Ruta                                                                                           | Commit |
| --- | -------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- | ------ |
| T1  | Picker: prop de selección inicial + reset solo sin selección inicial       | S1     | `web/src/components/sales/ProductPickerModal.tsx`                                              | WU1    |
| T2  | Venta: pasar la selección actual al reabrir el picker                      | S1, S4 | `web/src/components/sales/SaleNewModal.tsx`                                                    | WU1    |
| T3  | Venta: cancelar el picker vuelve al form (conserva cliente/importes/items) | S4     | `web/src/components/sales/SaleNewModal.tsx`                                                    | WU1    |
| T4  | Picker: cantidad que se puede escribir sin seleccionar todo                | S3     | `web/src/components/sales/ProductPickerModal.tsx`                                              | WU2    |
| T5  | Picker/Venta: la cantidad final se refleja en la modal de venta            | S2     | `web/src/components/sales/ProductPickerModal.tsx`, `web/src/components/sales/SaleNewModal.tsx` | WU2    |
| T6  | Tests de los 4 casos (RED → GREEN)                                         | S1-S4  | `web/src/components/sales/__tests__/` (nuevo)                                                  | WU2    |
| T7  | E2E del flujo: elegir → cambiar → cancelar → reintentar con más unidades   | S1-S4  | `web/e2e/buys-and-solds-flow.spec.ts`                                                          | WU3    |
| T8  | Push a `origin/master`                                                     | —      | —                                                                                              | —      |

**Work units**:

- **WU1** — preselección + volver al form al cancelar.
- **WU2** — input de cantidad + cantidad final en la modal + tests.
- **WU3** — e2e del flujo completo.

Dependencias: ninguna. Puede empezar en paralelo con `feature-toasts-sileo` (los toasts de "Venta registrada" se añaden después, en WU2 de ese feature).

## Log

- **L1 (2026-10-20, request original del usuario)**:

  > "2. En '/solds', si creo una nueva venta, elijo un producto con varias unidades disponibles pero solo escojo 1, me arrepiento y le doy a '+Cambiar productos' hay varios fallos:
  > 2.1. No está preseleccionado el que habías seleccionado antes
  > 2.2. Si seleccionas el mismo pero añades más unidades, en la modal de 'Nueva venta' se ve reflejado como si hubieras elegido solo una unidad
  > 2.3. Si cuando voy a seleccionar un producto del cual tenemos 15 unidades, en el input number pongo un 2, se pone un 12 y no me deja poner 2 a no ser que seleccione todo, ¿podemos arreglar eso de alguna manera àra mejorar la UX?
  > 2.4. Si cuando le doy a '+Cambiar productos' le doy a Cancelar, deberia ir a la modal de 'Nueva venta' manteniendo la info anterior, sin embargo, actualmente cancela toda la venta."

- **L2 (2026-10-20, evidencia — el picker no tiene preselección)**: `web/src/components/sales/ProductPickerModal.tsx`: las props son `isOpen`, `onClose`, `onConfirm`; el estado `checked` / `quantities` arranca en `{}` y el `useEffect` de apertura hace `setChecked({}); setQuantities({}); setFilter('')`. No hay forma de que el padre pase lo ya elegido.
- **L3 (2026-10-20, evidencia — cancelar cierra toda la venta)**: `web/src/components/sales/SaleNewModal.tsx` renderiza el picker con `onClose={() => { onClose(); }}` (comentario en el código: "Cancelar: cerrar todo el flujo"), mientras que `handlePickerConfirm` es el único camino que deja `showPicker = false` con los items cargados.
- **L4 (2026-10-20, evidencia — el input de cantidad concatena)**: el input es `type="number"` con `value={quantity}` (1 por defecto) y `onChange` → `Math.min(item.disponibles, Math.max(1, Number(e.target.value)))`. Con el cursor al final, escribir "2" sobre "1" produce "12".
- **L5 (2026-10-20, decisión)**: "Cancelar" en el picker **no** es un descarte: es un "volver atrás". El descarte sigue siendo el "Cancelar" de la modal de venta (o su backdrop), que ya cierra todo ✔.
- **L6 (2026-10-20, decisión)**: el picker no cambia de API pública (`onConfirm` sigue devolviendo `{buy_id, product_name, quantity}`); la selección inicial entra por una prop **opcional**, así que el resto de usos (el `ProductPickerModal` de otros flujos) no se rompen.
- **L7 (2026-10-20, pendiente de diagnóstico)**: el caso 2.2 no está diagnosticado (solo se conocen los sospechosos de L4). El WU2 lo diagnostica con un test que reproduzca el flujo antes de arreglarlo.
