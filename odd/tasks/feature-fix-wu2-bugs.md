# Feature: `fix-wu2-bugs` — 3 UX issues encontrados durante el fix del e2e

> El e2e de T14 (69bb95a) pasó con workarounds en los tests, pero los 3 issues que el test workaroundeaba son bugs reales de UX que el usuario vería. Los arreglo ahora antes de cerrar `feature-buys-and-solds`.

## Specs

- **S1 — `ProductPickerModal` pierde `product_name`**: el modal pasa `{buy_id, quantity}` al form padre en `onConfirm`. El form no puede reconstruir el nombre del producto y muestra `"Producto #N"`. El usuario ve un placeholder feo en vez del nombre real. Fix: el modal pasa `{buy_id, product_name, quantity}` y el form padre usa `product_name` para mostrar el nombre en la lista de items.
- **S2 — `CustomerAutocomplete` no sincroniza `inputValue` con `value` prop**: el hook usa `useState(value?.name ?? '')` que solo se inicializa en mount. Cuando `SoldEditPage` carga el customer y lo pasa como prop, el input queda vacío aunque el customer esté cargado. Fix: agregar un `useEffect` que sincronice `inputValue` cuando `value` cambia. Si `value` es null, vaciar el input.
- **S3 — `App.tsx` index `/` no monta `OverviewTab`**: el index de root renderiza `DashboardPage` con `<Outlet />` vacío (no tiene children anidados en la ruta `/`). Solo `/dashboard` monta el tab. El usuario que va a `/` ve un dashboard vacío. Fix: hacer que el index de root renderice `OverviewTab` directamente (import `OverviewTab` en `App.tsx` y usarlo para `{ index: true, element: <OverviewTab /> }` en la ruta `/`).

## Tasks

| ID  | Título                                                            | Specs      | Ruta                                                | Commit |
| --- | ----------------------------------------------------------------- | ---------- | --------------------------------------------------- | ------ |
| T1  | `ProductPickerModal`: pasar `product_name` en `onConfirm`         | S1         | `web/src/components/sales/ProductPickerModal.tsx`   | WU1    |
| T2  | `SoldNewPage`: usar `product_name` de cada item en la lista       | S1         | `web/src/pages/solds/SoldNewPage.tsx`               | WU1    |
| T3  | `SoldEditPage`: usar `product_name` de cada item en la lista      | S1         | `web/src/pages/solds/SoldEditPage.tsx`              | WU1    |
| T4  | `CustomerAutocomplete`: `useEffect` que sincronice `inputValue`   | S2         | `web/src/components/sales/CustomerAutocomplete.tsx` | WU1    |
| T5  | `App.tsx`: index `/` renderiza `OverviewTab` directamente         | S3         | `web/src/App.tsx`                                   | WU1    |
| T6  | `buys-and-solds-flow.spec.ts`: remover los 3 workarounds del test | S1, S2, S3 | `web/e2e/buys-and-solds-flow.spec.ts`               | WU1    |
| T7  | Tests: verificar que los fixes no rompen los e2e                  | S1, S2, S3 | (verificacion)                                      | WU1    |

**Work units (commits separados)**:

- **WU1 — fixes + spec cleanup (T1-T7)**: todos los fixes en un solo commit. Riesgo item 6 (sin tests adaptados la regresión en UX no se detecta — el e2e con los workarounds removidos es el test de regresión).

## Log

- **L1** (request del usuario, 2026-10-18): después de mergear WU2 + T15 a master y correr el e2e (69bb95a, 6/6 passing con workarounds), el usuario eligió arreglar los 3 bugs de UX que el worker de e2e encontró como workarounds en el test. Decisión: feature doc corto (3 fixes chicos), un solo WU. Branch: `fix/wu2-bugs` desde `master`.
- **L2** (cierre WU1 — pendiente hasta ejecución): los 3 fixes se commitean juntos. Verificación: `npm run typecheck -w web` (0 errores), `npm run lint -w web` (0 warnings), `npm test -w web -- --run` (78 tests passing), `npm run e2e -w web` (6/6 passing con los workarounds removidos). El spec del e2e queda como test de regresión de los fixes.
