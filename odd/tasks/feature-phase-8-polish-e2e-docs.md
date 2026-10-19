# Feature: `phase-8-polish-e2e-docs` — pulido UX + E2E adicionales + docs sincronizadas

> Cierra la Fase 8 de AGENTS.md: agregamos cobertura E2E de flujos no testeados (editar/borrar compra+venta, dark mode toggle, tabs dashboard) y sincronizamos la documentación con el estado real del proyecto (README desactualizado + cierre formal en AGENTS.md).

## Specs

### S1 — `README.md` refleja el estado real del proyecto

El README actual (a 2026-10-19) dice:

> Backend + frontend operativos con el modelo `sales` legacy (entradas manuales). Migración en curso al modelo `buys + solds + sale_items + customers` documentado en `odd/tasks/feature-buys-and-solds.md`.

Esto es **incorrecto**: el modelo `sales` legacy se dropeó en la migración 003 (commiteado en `634f467 feat(server): buys + solds + customers model (WU1)`); las features `buys-and-solds`, `dashboard-iteration-1`, `dark-mode` y `purchase-date-and-manual-sold-at` están cerradas y mergeadas en `master`.

Cambios:

- Estado: "Migración en curso" → "MVP manual cerrado y operativo con el modelo `buys + solds + sale_items + customers`".
- Agregar lista breve de las 4 features cerradas en `odd/tasks/`.
- Agregar `npm run e2e -w web` y `npm test --workspaces -- --run` a la sección de comandos.
- Mantener la nota de que scraping/CSV import están descartados por diseño.

### S2 — `AGENTS.md §7` y `§13` reflejan el cierre de Fase 8

- `§7` fila "**8** Pulido + E2E + docs": "pendiente" → ✅ (con la fecha del cierre, 2026-10-19).
- `§13` agregar una entrada con la fecha del cierre que diga: "Fase 8 cerrada: 5-6 e2e nuevos + docs sincronizadas. Ver `odd/tasks/feature-phase-8-polish-e2e-docs.md`."
- `§12` "Próximo paso inmediato": una vez cerradas las features vivas (lo cual sucede con este feature), actualizar el texto a reflejar que no queda trabajo orgánico hasta que aparezca un cambio UX nuevo.

### S3 — E2E: editar compra (`/buys/:id`)

`web/e2e/buys-and-solds-flow.spec.ts` (o nuevo spec `buys-edit-flow.spec.ts`): test que crea una compra vía API con valores conocidos (e.g., "Funda iPhone" / coste 100€ / cantidad 20), navega a `/buys/:id`, edita el coste a 150€, navega a `/buys` y verifica que la fila muestra el coste actualizado. Cubre el flujo completo de edición: pre-rellenado por `useEffect` + `reset()` (BuyEditPage.tsx L65), submit, navigate, refresh de la lista.

### S4 — E2E: editar venta (`/solds/:id`)

Similar a S3 pero para ventas. Crea venta vía API con un pack, navega a `/solds/:id`, edita `sale_price` o `notes`, verifica que `/solds` muestra el valor actualizado. **Importante**: los items del pack son inmutables una vez creada la venta (SoldEditPage.tsx docstring lo dice), así que el test edita solo los campos permitidos (precio / asociados / fecha / notas / cliente).

### S5 — E2E: borrar compra

Crea compra vía API, navega a `/buys/:id`, click en "Eliminar compra", confirma en el diálogo inline ("Sí, eliminar"), verifica que la navegación vuelve a `/buys` y que la fila ya no aparece en la lista.

### S6 — E2E: borrar venta

Similar a S5 pero para ventas. Borra una venta que tiene venta vinculada a un buy — verifica que el stock del buy vuelve al estado original (compra original - ventas borradas).

### S7 — E2E: dark mode toggle persiste en reload

Carga `/`, identifica el tema inicial leyendo `localStorage.getItem('salemanteiner-theme')` (o el atributo `class="dark"` en `<html>`), hace click en el toggle (`data-testid="theme-toggle"`), verifica que `localStorage` y el atributo cambiaron, hace `page.reload()`, verifica que el tema sigue siendo el que se seteó. Cubre: el anti-FOUC inline de `index.html` + el `useTheme` hook + la integración con el toggle.

### S8 — E2E: navegación entre tabs del dashboard

Carga `/dashboard`, verifica que el tab "Resumen" (`data-testid="dashboard-tab-resumen"`) está activo (clase `Resumen="border-brand-500 text-brand-600"`), click en "Ingresos", verifica que cambia y que `data-testid="cashflow-chart"` está visible (porque RevenueTab.tsx usa CashFlowChart desde el feature `dashboard-iteration-1`). Repite para "Productos" (`data-testid="products-table"`).

### S9 (no funcional, docs) — `feature-phase-8-polish-e2e-docs.md` Log con el cierre

Al cerrar el feature, agregar L1 con el detalle de los commits y la verificación final.

## Tasks

| ID  | Título                                                           | Specs | Ruta                                               | Commit |
| --- | ---------------------------------------------------------------- | ----- | -------------------------------------------------- | ------ |
| T1  | Actualizar `README.md` con estado real del proyecto              | S1    | `README.md`                                        | WU1    |
| T2  | Actualizar `AGENTS.md §7` (Fase 8 → ✅) y `§13` (nota de cierre) | S2    | `AGENTS.md`                                        | WU1    |
| T3  | E2E: editar compra                                               | S3    | `web/e2e/buys-and-solds-flow.spec.ts` (nuevo spec) | WU2    |
| T4  | E2E: editar venta                                                | S4    | `web/e2e/buys-and-solds-flow.spec.ts`              | WU2    |
| T5  | E2E: borrar compra                                               | S5    | `web/e2e/buys-and-solds-flow.spec.ts`              | WU2    |
| T6  | E2E: borrar venta                                                | S6    | `web/e2e/buys-and-solds-flow.spec.ts`              | WU2    |
| T7  | E2E: dark mode toggle persiste en reload                         | S7    | `web/e2e/buys-and-solds-flow.spec.ts`              | WU2    |
| T8  | E2E: navegación entre tabs del dashboard                         | S8    | `web/e2e/buys-and-solds-flow.spec.ts`              | WU2    |
| T9  | Log L1 del feature doc con cierre                                | S9    | `odd/tasks/feature-phase-8-polish-e2e-docs.md`     | WU3    |

**Work units**:

- **WU1 — docs (T1+T2)**: commit único `docs: sync README + AGENTS.md §7/§13 al estado real (Fase 8)`. Cambios bounded, sin código.
- **WU2 — e2e adicionales (T3-T8)**: commit `test(e2e): edit/delete + dark mode + dashboard tabs`. 6 specs nuevos en el mismo archivo e2e (mantiene el patrón actual de 1 archivo con N tests).
- **WU3 — log de cierre (T9)**: commit `docs: log L1 del feature phase-8-polish-e2e-docs`.

## Decisiones de producto (cerradas)

- **Estructura del e2e**: agregamos los 6 specs al mismo archivo `web/e2e/buys-and-solds-flow.spec.ts` en vez de crear uno nuevo. Mantiene el patrón actual (1 spec file con N tests por feature) y aprovecha los helpers de `web/e2e/fixtures.ts`. Si en el futuro crece a >20 specs, se parte.
- **Dark mode reload**: el test verifica `localStorage` + atributo `class="dark"` en `<html>` antes y después del reload. No verifica el render visual porque es redundante con el inline anti-FOUC de `index.html`.
- **Tabs dashboard**: usamos los `data-testid` que ya existen (`dashboard-tab-resumen`, `cashflow-chart`, `products-table`). Sin agregar nuevos testids.

## Log

- **L1** (request del usuario, 2026-10-19, textual): el usuario dijo "haz - §7 Fase 8" después de cerrar T15+T16 del feature `buys-and-solds`. La Fase 8 es ambigua en §7: "Pulido + E2E + docs". En la sesión anterior le propuse 4 alcances bounded y eligió el combo C: 5-6 e2e nuevos + actualizar README desactualizado + cierre formal en AGENTS.md. Branch: `master` desde `origin/master` (no requiere feature branch nuevo para un trabajo bounded y verificado). Risk item 6 (sin tests adaptados, regresión UX no detectada — mitigado con 6 e2e nuevos + 70 web tests + 113 server tests ya en verde). Sin risk item 1/2/3/4/5 (no toca BD, contratos REST, ni dependencias).

- **L2** (cierre, 2026-10-19): los 3 work units del feature se completaron en 2 commits. Acciones aplicadas:

  - **WU1 — docs (T1+T2, commit `docs: sync README + AGENTS.md al estado real (Fase 8 cierre)`)**: `README.md` reescrito para reflejar el estado real del proyecto (no más "migración en curso"; lista las 4 features mergeadas; agrega `npm test --workspaces -- --run` y `npm run e2e -w web` a la sección de comandos). `AGENTS.md §7` marca la Fase 8 como ✅ con la fecha del cierre y referencia al feature doc. `AGENTS.md §13` agrega una nota con fecha 2026-10-19 que dice "Fase 8 cerrada" y referencia al feature doc. Este feature doc también entra en el commit WU1 (es docs que enseña el feature, no tests).
  - **WU2 — e2e adicionales (T3-T8, commit `test(e2e): edit/delete + dark mode + dashboard tabs (Fase 8)`)**: 6 specs nuevos agregados a `web/e2e/buys-and-solds-flow.spec.ts`:
    1. T3: editar compra (cambiar coste de 100 a 150, verificar en lista).
    2. T4: editar venta (cambiar precio de 40 a 60, verificar en lista).
    3. T5: borrar compra (delete con confirmación inline, verificar lista).
    4. T6: borrar venta (delete con confirmación inline, verificar que el stock del buy se libera).
    5. T7: dark mode toggle persiste en reload (verifica localStorage + atributo `class="dark"` antes/después de reload).
    6. T8: tabs dashboard navegan (click en Resumen/Ingresos/Productos, verifica data-testids `overview-kpis` / `cashflow-chart` / `products-table`).
  - **WU3 — log L2**: este apartado. Cierra el feature.

  **Detalle de implementación** (1 issue menor en T8): el spec inicial asumía que `data-testid="products-table"` se renderiza siempre, pero `ProductsTab.tsx` L86 muestra ese data-testid solo cuando `sortedItems.length > 0` (si no hay ventas, muestra el mensaje "Todavía no hay ventas vendidas para armar el ranking."). El fix fue crear 1 venta antes de navegar al tab Productos, para que el ranking tenga al menos 1 producto. Esto refleja mejor el flow real: el dashboard se llena con datos cuando el usuario opera la app.

  **Verificación al cierre del feature**:
  - `npm run typecheck` — 0 errores (server + web).
  - `npm run lint` — 0 warnings (server + web).
  - `npm test --workspaces -- --run` — 113 server + 70 web passing.
  - `npm run e2e -w web` — 13/13 passing (7 previos + 6 nuevos).

  **Estado del proyecto al cierre**: MVP manual cerrado y operativo. Sin features vivos. Sin trabajo orgánico pendiente hasta el próximo cambio UX (que probablemente se documente en un feature doc nuevo siguiendo el patrón establecido).
