# Feature: `dashboard-iteration-1` — UI polish (8 cambios solicitados)

> 8 cambios de UI que el usuario pidió después de probar el feature `buys-and-solds`. Van desde cambios chicos (quitar un botón, traducir labels) hasta cambios estructurales (flujo de creación via modal, nuevo chart de cash flow, tablas ordenables).

## Specs

### S1 — Quitar el botón "+Nueva" del header

`web/src/components/layout/Layout.tsx`: eliminar el `<NavLink to="/solds/new">+ Nueva</NavLink>`. El nav queda con: **Dashboard · Compras · Ventas**. (El "+ Nueva" sigue existiendo dentro de cada lista como botón local — ver S3.)

### S2 — Label "Beneficio" con color dinámico en OverviewTab

`web/src/pages/dashboard/OverviewTab.tsx`: la KPI card "Beneficio neto" cambia a label **"Beneficio"**. El color del valor depende del signo:

- `beneficio_total_eur < 0` → `text-red-600 dark:text-red-400`
- `beneficio_total_eur === 0` → `text-orange-500 dark:text-orange-400`
- `beneficio_total_eur > 0` → `text-emerald-600 dark:text-emerald-400`

El prefijo `+` se mantiene para positivos (ya está en el código). Para negativos, el `-` lo pone `formatEuro`. El hint "ventas − COGS − gastos" se queda.

### S3 — Flujo de creación de buys y solds 100% en modal

Actualmente:

- /buys "+ Nueva compra" navega a `/buys/new` (página `BuyNewPage`).
- /solds "+ Nueva venta" abre `ProductPickerModal`, al confirmar navega a `/solds/new` con los items como state.

Cambio: ambos flujos se hacen completamente en modales, sin navegar a otra ruta:

- /buys "+ Nueva compra" → abre `BuyNewModal` (form: product_name, purchase_cost, quantity, associated_costs, purchase_date) → submit → modal cierra, lista refresca (React Query invalidation).
- /solds "+ Nueva venta" → abre `SaleNewModal` (flujo multi-step dentro de un solo componente modal):
  - Step 1: `ProductPickerModal` (seleccionar productos con cantidad, multi-select).
  - Step 2: form de venta (customer via `CustomerAutocomplete`, sale_price, associated_costs, notes, lista de items seleccionados).
  - Submit → modal cierra, lista refresca.

Resultado: `/buys/new` y `/solds/new` se eliminan como rutas. `BuyNewPage.tsx` y `SoldNewPage.tsx` se borran. `BuyNewModal` y `SaleNewModal` se crean como componentes nuevos.

### S4 — / y /dashboard son la misma vista

`web/src/App.tsx`: el index de root (`/`) y la ruta `/dashboard` renderizan el mismo componente (`DashboardPage` con nested routes). El index de `DashboardPage` sigue siendo `OverviewTab`. Eliminar la duplicación actual donde `/` renderiza `OverviewTab` directamente y `/dashboard` renderiza `DashboardPage`.

### S5 — Nuevo chart de cash flow (reemplaza revenue/profit)

El chart actual de OverviewTab muestra revenue y profit por mes. El usuario lo reemplaza con un chart de **cash flow**: `compras` (lo que gasté) vs `ventas` (el beneficio que obtuve).

Cálculo por mes:

- `compras` = `SUM(buys.purchase_cost + buys.associated_costs for buys in this month)` + `SUM(solds.associated_costs for solds in this month)`
- `ventas` = `SUM of per-sale realized profit for solds in this month` = `SUM(sale_price - sale.associated_costs - COGS_pro_rated - buy.associated_costs_pro_rated)`
- `neto` = `compras - ventas` (negativo = gastando más de lo que gano, positivo = rentable)

El chart muestra la línea de `neto` por mes. Las áreas se colorean: bajo cero (zona de pérdida) en `bg-red-50/30` (`dark:bg-red-950/20`), sobre cero (zona de ganancia) en `bg-emerald-50/30` (`dark:bg-emerald-950/20`).

Cambios server:

- `server/src/repo/solds-repo.ts`: `statsDashboard()` reemplaza `revenueByMonth: [{ month, revenue, profit }]` con `cashFlowByMonth: [{ month, compras, ventas, neto }]`. Las queries SQL se actualizan (la de "compras" agrupa por `purchase_date` para buys y `sold_at` para solds; la de "ventas" calcula el profit realizado por mes).
- `server/src/__tests__/stats-dashboard.test.ts`: actualizar tests para el nuevo payload (los 9 tests existentes se reescriben).

Cambios client:

- `web/src/api/solds.ts`: tipo `DashboardStats` se actualiza (`revenueByMonth` → `cashFlowByMonth`).
- `web/src/components/dashboard/RevenueChart.tsx` se renombra a `CashFlowChart.tsx` y muestra la nueva data (línea de `neto` + área coloreada).
- `web/src/pages/dashboard/OverviewTab.tsx` usa el nuevo chart.
- `web/src/pages/dashboard/RevenueTab.tsx` también usa el nuevo chart (reemplaza el revenue/profit por cash flow) — se traduce a español (ver S7).

### S6 — Top 5 colapsables con localStorage

`web/src/pages/dashboard/OverviewTab.tsx`: los "Top 5 productos" y "Top 5 compradores" se reemplazan con secciones colapsables.

- Cada sección tiene un header clickeable (botón con chevron `▶`/`▼`) que muestra/oculta el contenido.
- El estado de collapse se guarda en `localStorage` con claves `dashboard-overview-products-collapsed` y `dashboard-overview-compradores-collapsed` (boolean).
- El link "Ver todos →" se elimina de ambas secciones. Las vistas individuales en `/dashboard/products` y `/dashboard/buyers` siguen existiendo, pero no se linkean desde Overview.
- Por default, ambas secciones arrancan expandidas.

### S7 — Traducir RevenueTab a español

`web/src/pages/dashboard/RevenueTab.tsx`: todas las labels y hints en español:

- "Revenue YTD" → "Ingresos YTD"
- "Profit YTD" → "Beneficio YTD"
- "revenue − COGS − gastos" → "ingresos − COGS − gastos"
- "Revenue y profit por mes" → "Ingresos y beneficio por mes"
- "últimos 12 meses" se queda (ya en español).
- "Mejor mes" se queda.
- "sin ventas registradas" se queda.

Si el chart cambia a cash flow (S5), el header del chart también: "Revenue y profit por mes" → "Cash flow por mes" o "Compras vs ventas por mes".

### S8 — ProductsTab sin chart, tablas ordenables

`web/src/pages/dashboard/ProductsTab.tsx`:

- Se elimina el `TopProductsChart` (el gráfico de barras horizontal).
- La tabla detalle pasa a ser ordenable: click en el header de cada columna cicla entre 3 estados — **neutral → ascendente → descendente → neutral**.
- Solo se ordena por una columna a la vez (la última clickeada).
- Indicador visual del estado de sort: `▲` para ascendente, `▼` para descendente, sin icono para neutral.

`web/src/pages/dashboard/BuyersTab.tsx`: misma lógica de sort (mismo componente reutilizable).

Implementación: crear un hook `useSortable<T>(items, defaultKey?)` en `web/src/hooks/useSortable.ts` que devuelva `{ sortedItems, sortKey, sortDir, onSort }`. El `onSort` cicla los 3 estados. Alternativa: TanStack Table (ya está en dependencies) — más overhead, usar el hook es más simple para tablas chicas.

## Tasks

| ID  | Título                                                                      | Specs  | Ruta                                                     | Commit |
| --- | --------------------------------------------------------------------------- | ------ | -------------------------------------------------------- | ------ |
| T1  | Layout: quitar "+Nueva" del header                                          | S1     | `web/src/components/layout/Layout.tsx`                   | WU1    |
| T2  | OverviewTab: label "Beneficio" con color dinámico                           | S2     | `web/src/pages/dashboard/OverviewTab.tsx`                | WU1    |
| T3  | `BuyNewModal` (form modal para crear compra)                                | S3     | `web/src/components/sales/BuyNewModal.tsx` (nuevo)       | WU1    |
| T4  | `SaleNewModal` (multi-step: ProductPicker + sale form)                      | S3     | `web/src/components/sales/SaleNewModal.tsx` (nuevo)      | WU1    |
| T5  | BuysListPage: usar `BuyNewModal` en vez de navegar                          | S3     | `web/src/pages/buys/BuysListPage.tsx`                    | WU1    |
| T6  | SoldsListPage: usar `SaleNewModal` en vez de navegar                        | S3     | `web/src/pages/solds/SoldsListPage.tsx`                  | WU1    |
| T7  | App.tsx: / y /dashboard misma vista; eliminar /buys/new y /solds/new        | S3, S4 | `web/src/App.tsx`                                        | WU1    |
| T8  | Eliminar `BuyNewPage.tsx` (reemplazado por modal)                           | S3     | `web/src/pages/buys/BuyNewPage.tsx` (delete)             | WU1    |
| T9  | Eliminar `SoldNewPage.tsx` (reemplazado por modal)                          | S3     | `web/src/pages/solds/SoldNewPage.tsx` (delete)           | WU1    |
| T10 | Server: `statsDashboard` devuelve `cashFlowByMonth` (compras/ventas/neto)   | S5     | `server/src/repo/solds-repo.ts`                          | WU1    |
| T11 | Server tests: actualizar `stats-dashboard.test.ts` para nuevo payload       | S5     | `server/src/__tests__/stats-dashboard.test.ts`           | WU1    |
| T12 | Client: `DashboardStats` type actualizado                                   | S5     | `web/src/api/solds.ts`                                   | WU1    |
| T13 | Client: `CashFlowChart` (reemplaza `RevenueChart` con nueva data)           | S5     | `web/src/components/dashboard/CashFlowChart.tsx` (nuevo) | WU1    |
| T14 | Client: OverviewTab usa cash flow chart                                     | S5     | `web/src/pages/dashboard/OverviewTab.tsx`                | WU1    |
| T15 | Client: `RevenueChart.tsx` borrado (reemplazado por `CashFlowChart`)        | S5     | `web/src/components/dashboard/RevenueChart.tsx` (delete) | WU1    |
| T16 | Client: OverviewTab Top 5 colapsables con localStorage                      | S6     | `web/src/pages/dashboard/OverviewTab.tsx`                | WU1    |
| T17 | Client: RevenueTab traducido a español                                      | S7     | `web/src/pages/dashboard/RevenueTab.tsx`                 | WU1    |
| T18 | Client: ProductsTab sin chart, tabla ordenable 3 estados                    | S8     | `web/src/pages/dashboard/ProductsTab.tsx`                | WU1    |
| T19 | Client: BuyersTab tabla ordenable 3 estados                                 | S8     | `web/src/pages/dashboard/BuyersTab.tsx`                  | WU1    |
| T20 | Client: hook `useSortable` reutilizable                                     | S8     | `web/src/hooks/useSortable.ts` (nuevo)                   | WU1    |
| T21 | e2e: actualizar `buys-and-solds-flow.spec.ts` para modal flow + nuevo chart | S3, S5 | `web/e2e/buys-and-solds-flow.spec.ts`                    | WU1    |

**Work units**:

- **WU1 — todo junto (T1-T21)**: 8 cambios que el usuario pidió en un solo mensaje. El worker los implementa juntos. Si pasan las verificaciones, se commitea en 1-2 commits (server + web).

## Decisiones de producto (cerradas)

- **Chart de cash flow**: la línea principal es `neto` (compras - ventas). Las áreas se colorean: bajo cero en rojo claro, sobre cero en verde claro. Esto da una señal visual inmediata de la salud del negocio.
- **Sortable tables**: patrón de 3 estados (neutral → asc → desc → neutral). Solo una columna a la vez. Indicador visual (▲ / ▼ / sin icono).
- **Modal flow**: la creación de buys y solds se hace completamente en modales. No hay navegación. La lista actualiza via React Query invalidation después del submit.
- **/ y /dashboard**: misma vista (`DashboardPage` con nested routes).
- **Top 5 colapsables**: default expandidas. Estado persistido en localStorage.
- **Sin "Ver todos" desde Overview**: las vistas individuales en `/dashboard/products` y `/dashboard/buyers` siguen existiendo (linkeables directamente vía URL), pero no se linkean desde Overview.

## Log

- **L1** (request del usuario, 2026-10-18, textual): el usuario dio 8 instrucciones específicas para pulir la UI del dashboard y el nav después de probar el feature buys-and-solds:
  1. Quitar "+Nueva" del header.
  2. Label "Beneficio" (sin "neto") con color dinámico (rojo/negativo, naranja/cero, verde/positivo).
  3. Consistencia en creación: ambos (buys y solds) en modal, sin navegar a otra ruta.
  4. / y /dashboard misma vista.
  5. Chart de cash flow (compras - ventas) en vez de revenue/profit.
  6. Top 5 colapsables con localStorage, sin "Ver todos".
  7. Traducir RevenueTab a español.
  8. ProductsTab sin chart, tablas ordenables en 3 estados.

  Branch: `feature/dashboard-iteration-1` desde `master`. Risk item 6 (sin tests adaptados, la regresión en UX no se detecta — mitigado con e2e y tests Vitest que se actualizan).

- **L2** (cierre WU1 — **PARCIAL**, hay work pendiente): el worker `mve2fn2w-6-forg` terminó los 8 cambios del feature (Dashboard, 7/7 e2e passing, 113 server + 70 web tests). Sin embargo, hay work pendiente antes de commitear. Ver `L8` para el detalle completo.

- **L8** (snapshot de handoff — 2026-10-18, fin de sesión): estado completo del working tree y work pendiente para retomar en otra sesión.

  **Worker `mve2fn2w-6-forg` (dashboard-iteration-1) — COMPLETADO**:
  - 5 archivos creados: `web/src/components/dashboard/CashFlowChart.tsx`, `web/src/components/sales/BuyNewModal.tsx`, `web/src/components/sales/SaleNewModal.tsx`, `web/src/hooks/useCollapsible.ts`, `web/src/hooks/useSortable.ts`.
  - 5 archivos eliminados: `web/src/components/dashboard/RevenueChart.tsx`, `web/src/pages/buys/BuyNewPage.tsx`, `web/src/pages/solds/SoldNewPage.tsx`, `web/src/components/sales/__tests__/BuyNewPage.test.tsx`, `web/src/components/sales/__tests__/SoldNewPage.test.tsx`.
  - 13 archivos modificados: Layout, App.tsx, solds.ts, fixtures.ts, OverviewTab, RevenueTab, ProductsTab, BuyersTab, BuysListPage, SoldsListPage, e2e spec, 2 server.
  - Verificación: 113 server + 70 web + 7/7 e2e passing.
  - **Decisión documentada que requiere validación del usuario**: `neto = compras - ventas` (interpretación literal del spec). Convención: negativo = pérdida, positivo = ganancia. Pero la lectura natural de "cash flow" sería `ventas - compras` (profit). Si el usuario quería `ventas - compras`, hay que invertir 1 línea en `solds-repo.ts` (firma `neto` en `cashFlowByMonth`) y ajustar el color del chart (invertir rojo/verde).

  **Bugs reportados por el worker (workaround en e2e, no fixados)**:
  1. `ProductPickerModal` perdía `product_name` → FIXED en el commit `cad2dee` (FIX-WU2 feature). El worker de dashboard-iteration-1 partió de ese fix.
  2. `CustomerAutocomplete` no sincronizaba `inputValue` con `value` → FIXED en el mismo commit.
  3. `App.tsx` index `/` no montaba `OverviewTab` → FIXED en el mismo commit.
  4. `BuysListPage` no calculaba `disponibles` real → **OVERWRITTEN por el worker de dashboard-iteration-1**. Ver "Work pendiente" abajo.
  5. `SoldsListPage` no calculaba `profit` real → **OVERWRITTEN por el worker de dashboard-iteration-1**. Ver "Work pendiente" abajo.

  **Work pendiente (para retomar en otra sesión)**:

  1. **Linter blocker en `solds-repo.ts`**: SQL injection false positive en `${where}` interpolation de `listWithProfit`. El `eslint-disable-next-line` está en la línea equivocada (antes de `const rows = db` en vez de antes de `.prepare(`). Fix: mover el comment para que aplique a la línea del `.prepare(`. El linter (probablemente `eslint-plugin-security` regla `detect-non-literal-sql`) flaggea el `.prepare(` call.

  2. **Re-aplicar fix de stock en `BuysListPage`**: el worker de dashboard-iteration-1 sobrescribió mi fix anterior. Estado actual:
     - `web/src/api/buys.ts`: ya tiene `ListResponse.data: BuyWithStock[]` (OK).
     - `server/src/repo/buys-repo.ts`: **NO** tiene `listWithStock` method. Hay que agregarla.
     - `server/src/routes/buys.ts`: el list route usa `repo.list(filters)` (debería ser `repo.listWithStock(filters)`).
     - `web/src/pages/buys/BuysListPage.tsx`: tiene el local `BuyWithStock` interface y el placeholder `disponibles: b.quantity`. Hay que importarlo del API y usar el dato real.
     - `web/e2e/buys-and-solds-flow.spec.ts` test 3: usa el workaround `page.locator('tbody').getByText('20').first()`. Hay que actualizarlo a `getByText('15')` (el stock real).

  3. **Re-aplicar fix de profit en `SoldsListPage`**: el worker de dashboard-iteration-1 sobrescribió mi fix anterior. Estado actual:
     - `web/src/api/solds.ts`: **NO** tiene `SoldWithProfit` type. Hay que agregarlo.
     - `server/src/repo/solds-repo.ts`: tiene `listWithProfit` method y `SoldWithProfit` type (OK). PERO el list route usa `repo.list(filters)` (debería ser `repo.listWithProfit(filters)`).
     - `web/src/pages/solds/SoldsListPage.tsx`: tiene el local `SoldWithCustomer extends Sold` y el placeholder `(con items)`. Hay que importarlo del API y usar el profit real.

  4. **Decisión del usuario sobre `neto`**: el worker implementó `neto = compras - ventas` per el spec literal. El usuario debe confirmar si la convención es correcta o si quiere `ventas - compras` (profit natural). Si invierte, hay que:
     - Cambiar `neto = compras - ventas` → `neto = ventas - compras` en `solds-repo.ts` (línea ~484).
     - Invertir los colores del chart en `CashFlowChart.tsx` (lo que es verde es rojo y viceversa).

  5. **Commit único**: cuando todo lo anterior esté verde, commitear todo (worker's dashboard-iteration-1 + mis fixes de stock/profit + el fix del linter blocker) en 1-2 commits. Mensaje del commit: `feat: dashboard iteration 1 + stock/profit fixes`.

  **Skills que el próximo subagente debería leer** (si se delega):
  - `web/.agents/skills/accessibility/SKILL.md` — para el autocomplete y la modal.
  - `web/.agents/skills/tailwind-css-patterns/SKILL.md` — para las clases duales `dark:` y la convención de tokens.
  - `web/.agents/skills/react-best-practices/SKILL.md` — para hooks y state.
  - `web/.agents/skills/composition-patterns/SKILL.md` — para entender la separación de componentes.
  - `server/.agents/skills/zod/SKILL.md` — para los schemas.
  - `server/.agents/skills/vitest/SKILL.md` — para los tests.

  **Allowed edit surfaces para el próximo worker** (si se delegan los fixes de stock/profit):
  - `server/src/repo/buys-repo.ts` (agregar `listWithStock`)
  - `server/src/routes/buys.ts` (cambiar list route a `listWithStock`)
  - `server/src/routes/solds.ts` (cambiar list route a `listWithProfit`)
  - `web/src/api/solds.ts` (agregar `SoldWithProfit`, cambiar `ListResponse.data`)
  - `web/src/pages/buys/BuysListPage.tsx` (usar `BuyWithStock` del API)
  - `web/src/pages/solds/SoldsListPage.tsx` (usar `SoldWithProfit` del API)
  - `web/e2e/buys-and-solds-flow.spec.ts` (actualizar test 3)
  - `server/src/repo/solds-repo.ts` (mover el eslint-disable comment)

  **NO tocar**:
  - Los archivos que el worker de dashboard-iteration-1 ya modificó correctamente (OverviewTab, RevenueTab, ProductsTab, BuyersTab, App.tsx, Layout.tsx, CashFlowChart.tsx, BuyNewModal.tsx, SaleNewModal.tsx, useCollapsible.ts, useSortable.ts, solds-api.ts con `DashboardStats` nuevo).
  - `AGENTS.md`, `README.md`, otros `odd/tasks/`.

  **Verificación al final**:
  - `npm run typecheck -w server` y `npm run typecheck -w web` — 0 errores.
  - `npm run lint -w server` y `npm run lint -w web` — 0 warnings.
  - `npm test -w server -- --run` — 109+ tests passing.
  - `npm test -w web -- --run` — 70+ tests passing.
  - `npm run e2e -w web` — 7/7 passing con los fixes de stock/profit (test 3 ahora verifica "15" en vez de "20").

  **Decisión del usuario pendiente** (preguntar antes de commitear):
  1. ¿La convención de `neto` es `compras - ventas` (worker) o `ventas - compras` (natural)?

- **L9** (cierre — 2026-10-19, sesión "continuamos con lo que dejamos a medio gas"):
  - Decisiones del usuario:
    1. `neto = compras - ventas` (literal spec, no se invierte).
    2. `/buys` muestra TODAS las compras con disponibles reales (las ya vendidas con `disponibles=0` en gris).
  - Cambios aplicados en la sesión (commit `fb0e561` "fix: stock and profit on lists match real inventory"):
    - `server/src/repo/buys-repo.ts`: nuevo método `listWithStock(filters)` que devuelve TODAS las compras + disponibles (sin filtrar `WHERE > 0`).
    - `server/src/routes/buys.ts`: `GET /api/buys` usa `listWithStock(filters)`. `GET /api/buys/stock` sigue con `getWithStock()` (sin cambios).
    - `server/src/routes/solds.ts`: `GET /api/solds` usa `listWithProfit(filters)`.
    - `web/src/api/buys.ts`: `BuyWithStock extends Buy` (antes declaraba campos propios); `ListResponse.data` pasa a `BuyWithStock[]`.
    - `web/src/api/solds.ts`: nuevo `SoldWithProfit extends Sold` con `profit`; `ListResponse.data` pasa a `SoldWithProfit[]`.
    - `web/src/pages/buys/BuysListPage.tsx`: usa `BuyWithStock` del API directo (sin placeholder); interfaz local + `useMemo` placeholder eliminados.
    - `web/src/pages/solds/SoldsListPage.tsx`: usa `SoldWithProfit` del API directo; columna "Beneficio" muestra profit real con color dinámico (verde/rojo/gris).
    - `web/e2e/buys-and-solds-flow.spec.ts`: test 3 ahora verifica `20` (Cantidad) + `15` (Disponibles reales) en vez de buscar solo `20` (workaround).
    - `server/src/repo/solds-repo.ts`: removido `eslint-disable-next-line security/detect-non-literal-sql` huérfano (la regla no existe en la config del server; la interpolación de `${where}` es segura — solo literales de columna, valores como parámetros `?`). Cleanup incluido en el commit 1 junto al cambio del worker.
  - Verificación al cierre:
    - `npm run typecheck` — 0 errores (server + web).
    - `npm run lint` — 0 warnings (server + web).
    - `npm test --workspaces -- --run` — 113 server + 70 web passing.
    - `npm run e2e -w web` — 7/7 passing (test 3 con `15` reales).
  - Estructura de commits:
    1. `103ff15 feat: dashboard iteration 1 (8 UI changes)` — 24 archivos (worker + cleanup del eslint-disable).
    2. `fb0e561 fix: stock and profit on lists match real inventory` — 8 archivos (wiring final de stock/profit).
  - Pendiente que sigue abierto (no resuelto aquí):
    - Push a origin (decisión del usuario; rama `master` local está 12 commits ahead).
