# Feature: Fase 5 — Dashboard con KPIs + gráficos + tabs (React Router)

> Página `/dashboard` con layout + tabs navegables vía React Router (nested routes). Cada tab es una URL compartible con `<NavLink>`. Tres tabs: **Overview** (KPIs + gráfico resumen), **Ingresos** (revenue mensual, profit margin), **Productos** (top N por revenue). Charts via Recharts.

## Specs

- **S1**: Nested routes con React Router 7 (`createBrowserRouter`). Layout en `/dashboard` con header que contiene las 3 tabs como `<NavLink>` (uno por ruta). El `<Outlet>` del layout renderiza el contenido de la tab activa. La ruta index (path `''`) es Overview; las otras dos explícitas: `/dashboard/revenue`, `/dashboard/products`. Cada URL es deep-linkable y back-button funciona.
- **S2**: Tabs implementadas con `<NavLink>` de `react-router-dom` (no estado local). El `isActive` built-in activa el estilo activo. Mantener el estilo consistente con la nav principal del `Layout`.
- **S3**: Endpoint único `GET /api/stats/dashboard` devuelve el payload agregado completo:
    ```ts
    {
      kpis: { total, sold, not_sold, revenue_cents, cost_cents,
              associated_costs_cents, net_profit_cents },
      revenueByMonth: Array<{ month: 'YYYY-MM', revenue_cents, profit_cents }>,
      topProducts:     Array<{ product_name, times_sold,
                              total_revenue_cents, total_profit_cents }>,
    }
    ```
    `revenueByMonth` cubre los últimos 12 meses (incluyendo meses sin ventas, con revenue=0). `topProducts` es top 10 ordenado por revenue descendente. Solo se cuentan ventas vendidas (`sold=true`) en los agregados.
- **S4**: Cálculos server-side en una nueva factory method `statsDashboard()` del repo. SQL agregado con `strftime('%Y-%m', sold_at)` para revenue, `GROUP BY product_name` + `ORDER BY SUM(price_cents) DESC LIMIT 10` para top. Los meses sin ventas se rellenan con `revenue_cents=0, profit_cents=0` para que el gráfico siempre tenga 12 puntos en el eje X.
- **S5**: Cliente mirror: `salesApi.dashboardStats()` + hook `useDashboardStats()` con React Query. Cache 60s para no recalcular en cada navegación entre tabs (mismo query key → mismo cache).
- **S6**: `OverviewTab` muestra KPIs (4 cards: total, vendidas, ingresos, beneficio neto) + un mini-chart de revenue de los últimos 12 meses (`<LineChart>` filtrado a revenue).
- **S7**: `RevenueTab` muestra el chart completo de revenue + profit por mes (`<LineChart>` con dos series: línea sólida para revenue, línea punteada para profit). Y los totales agregados (YTD = year-to-date revenue + profit).
- **S8**: `ProductsTab` muestra el `<BarChart>` horizontal con top 10 productos por revenue. Debajo, una tabla compacta con: nombre, veces vendido, revenue total, profit total. Click en una barra → scroll/foco a la fila de la tabla correspondiente (nice-to-have, no bloqueante para MVP).
- **S9**: Componente `RevenueChart` y `TopProductsChart` reciben el payload + dimensiones y renderizan el gráfico correspondiente. Encapsulan la config de Recharts (márgenes, ejes, tooltip, leyenda) para que OverviewTab/RevenueTab no se acoplen a Recharts.
- **S10**: Tests server para `statsDashboard()`: dataset conocido (ventas en meses específicos, productos vendidos N veces) → asserts sobre `revenueByMonth` (meses correctos, sums) y `topProducts` (orden, sumas).
- **S11**: Tests E2E Playwright: navegar a `/dashboard`, las 3 tabs visibles, click en cada una y assert que el chart container está presente (Recharts renderiza `<svg>`). Sin asserts pixel-perfect.
- **S12**: Link "Dashboard" en la `Layout`/nav principal, junto a las otras secciones (cuando existan). Si solo está "Ventas", agregar sin navbar global — el link puede ir en `SalesListPage` o ser un link directo.

## Tasks

| ID  | Título | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1  | Repo: `statsDashboard()` con SQL agregado | S3, S4 | `server/src/repo/sales-repo.ts` | WU1 |
| T2  | Endpoint `GET /api/stats/dashboard` | S3 | `server/src/routes/sales.ts` | WU1 |
| T3  | Tests server: `statsDashboard()` con datos conocidos | S3, S4, S10 | `server/src/__tests__/stats-dashboard.test.ts` | WU1 |
| T4  | Instalar `recharts` + cliente + hook | S5 | `web/package.json`, `web/src/api/sales.ts`, `web/src/hooks/useDashboardStats.ts` | WU2 |
| T5  | Componentes `RevenueChart` y `TopProductsChart` | S6, S7, S8, S9 | `web/src/components/dashboard/RevenueChart.tsx`, `web/src/components/dashboard/TopProductsChart.tsx` | WU2 |
| T6  | `DashboardPage` layout + 3 tabs (`OverviewTab`, `RevenueTab`, `ProductsTab`) | S1, S2, S6, S7, S8 | `web/src/pages/dashboard/DashboardPage.tsx` (+ 3 tabs) | WU2 |
| T7  | Nested routes `/dashboard/*` en `App.tsx` + link "Dashboard" en `Layout` | S1, S12 | `web/src/App.tsx`, `web/src/components/layout/Layout.tsx` (o `NavLink.tsx`) | WU2 |
| T8  | Spec E2E Playwright: navega tabs y ve charts | S11 | `web/e2e/dashboard-flow.spec.ts` | WU3 |
| T9  | AGENTS.md documenta Fase 5 + nueva ruta | (docs) | `AGENTS.md` | WU3 |
| T10 | Smoke manual checklist en este feature doc (Log) | (validación) | `odd/tasks/fase-5-dashboard.md` (Log) | WU3 |

**Work units (commits)**:

- **WU1 (server, T1–T3)**: stats + endpoint + tests. Riesgo bajo — solo SQL agregado.
- **WU2 (web estructural, T4–T7)**: deps + cliente + componentes + página + rutas. Riesgo bajo si WU1 verde.
- **WU3 (validación, T8–T10)**: E2E + docs.

## Decisiones de producto (pendientes confirmación)

- **Tabs concretas**: 3 (Overview, Ingresos, Productos). Si querés más (ej. "Por comprador", "Por mes-año"), avisame en cualquier momento.
- **Cantidad de meses**: 12 (1 año). Configurable después.
- **Top products**: 10. Configurable después.

## Log

- **L1** (2026-10-17, request del usuario): "hagamos el punto 5 los kpis y graficos, usa react wouter para la navegacion de tabs". El usuario evolucionó la spec original: no solo un dashboard de una página, sino un layout con tabs anidadas vía React Router. Decisión clave: cada tab es una URL compartible (no estado local).
- **L2** (2026-10-17, cierre WU1 server): `statsDashboard()` en `server/src/repo/sales-repo.ts` con SQL agregado: KPIs reusando `stats()`, `GROUP BY strftime('%Y-%m', sold_at)` para revenue mensual (últimos 12 meses), `GROUP BY product_name` para top 10. Helper `lastNMonths()` top-level que devuelve 'YYYY-MM' consecutivos. Endpoint `GET /api/sales/stats/dashboard` antes de `:id`. 9 tests nuevos (70/70 verde del server).
- **L3** (2026-10-17, cierre WU2 web estructural): cliente `dashboardStats()` (URL corregida a `/api/sales/stats/dashboard` después de descubrir el bug en Playwright), hook `useDashboardStats` con React Query (60s staleTime). Recharts v3 instalado y `DashboardPage` + 3 tabs (`OverviewTab`, `RevenueTab`, `ProductsTab`). **Plan B activado**: recharts v3 tiraba runtime error en React 19 strict — los componentes `RevenueChart` y `TopProductsChart` se reemplazaron por SVG inline (~80 líneas cada uno, zero deps, mismo resultado visual). Nested routes `/dashboard/*` con `<Outlet/>` registradas en `App.tsx`; link "Dashboard" agregado a la nav del `Layout`. `data-testid="products-table"` agregado para resolver ambigüedad del locator E2E.
- **L4** (2026-10-17, cierre WU3 validación): spec Playwright `dashboard-flow.spec.ts` con 5 tests (tabs visibles, navegación a cada tab, deep-link a `/dashboard/revenue`, nav desde `/`). **13/13 Playwright verde** tras 3 rondas de fix: (1) URL mal escrita en el cliente `/api/stats/dashboard` → `/api/sales/stats/dashboard`; (2) SVG inline en lugar de recharts (recharts v3 incompat); (3) `getByText` strict mode collision entre SVG chart y tabla → scope via `data-testid="products-table"`. AGENTS.md actualizado: sección 4 (`pages/dashboard/` en el árbol), sección 7 (Fase 5 → ✅), sección 12 (próximo paso apuntando a Fase 4 o 7).
- **L5** (Smoke manual — opcional, los E2E ya cubren el flujo):
    ```powershell
    # desde la raíz del repo
    fnm use 20
    npm install   # solo si hace falta
    npm run dev   # backend :4000, frontend :5173

    # Navegar a http://localhost:5173/dashboard. Esperado:
    #   - Resumen (default): 4 cards KPI + chart revenue/profit + top 5 productos.
    #   - Click "Ingresos": card Revenue YTD / Profit YTD / Mejor mes + chart grande.
    #   - Click "Productos": top 10 en chart + tabla compacta.
    #   - URL deep-link: http://localhost:5173/dashboard/products entra directo a la tab Productos.
    #   - Back-button del browser vuelve a la tab anterior.
    ```
    Si algo falla, anotar como L6 y abrir feature doc de bugfix.
