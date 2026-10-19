# Feature: charts con recharts + normalización de formato

Migrar el chart del dashboard de SVG inline a **recharts** (la dependencia ya estaba en `web/package.json` pero sin uso), eliminar el chart muerto, normalizar el repo con Prettier y cerrar con un smoke manual en navegador real.

**Contexto**: en Fase 5 se descartó recharts v3 por un crash en runtime con React 19 strict mode y se pasó a SVG inline. Un spike con la versión instalada (recharts 3.10.1 + React 19.3.1) **renderiza bien en jsdom**; el veredicto real lo da el e2e en Chromium (ver L2).

**Riesgo del feature**: ninguno de datos (es presentación). El riesgo real es **visual**: cambiar el motor de render de los charts puede alterar lo que el usuario ve.

## Specs

### S1 — El chart de flujo de caja se dibuja con recharts

> "1. usa recharts en vez de graficos inline con svg."

El `CashFlowChart` (flujo de caja mensual, 2 series) se implementa con recharts en lugar de SVG a mano. Se mantiene **todo** el contrato observable:

- `data-testid="cashflow-chart"` (lo usan 3 asserts del e2e).
- Estado vacío: `"Sin datos."` cuando no hay meses.
- Dos series: **Compras (gastos)** (rojo) y **Ventas (ingresos)** (verde).
- Eje Y: dominio explícito `[yMin, yMax]` con `yMin = min(0, min(ventas))` y `yMax = max(1, max(compras))` → el cero siempre está y las ventas negativas (profit < 0) se ven.
- Eje X: meses en español (`ene`, `feb`, …).
- Importes en **euros** (`formatEuro` en el tooltip, formato corto `1,2k €` en los ticks).
- Dark mode: la grilla, los ejes y el texto se adaptan; las series cambian de tono en dark.
- Accesible: `role="img"` + `aria-label` en el contenedor.

### S2 — El chart muerto se elimina

`TopProductsChart.tsx` es código muerto: `ProductsTab` lo eliminó en S8 del feature `dashboard-iteration-1` (la tab muestra solo la tabla) y nadie lo importa. Se borra el archivo en vez de portarlo a recharts.

### S3 — El e2e se actualiza al nuevo DOM

El e2e assertaba `svg path` con count 2 (las dos líneas del SVG inline). Con recharts el SVG tiene otra estructura (curvas, ticks, ejes). El assert pasa a contar las capas de línea de recharts.

### S4 — El repo se normaliza con Prettier

> "3. si tiene sentido que esten normalizados, hazlo"

`npm run format:check` está rojo desde antes de este feature (64 archivos) y por eso nunca fue un gate real. Si el `.prettierrc.json` del repo va a ser la convención, se aplica en un commit **aislado** (chore) para que el ruido de reformat no se mezcle con cambios de comportamiento, y a partir de ahí `format:check` sí es gate.

### S5 — Smoke manual en navegador real

> "4. hazlo"

Los 15 e2e cubren el flujo principal, pero el dark mode toggle y el responsive quedan fuera. Smoke manual en `localhost:5173` con navegador real: navegación, chart, toggle de dark mode y viewport angosto.

## Tasks

| ID  | Título                                                                | Specs  | Ruta                                                                                                                                                                   | Commit |
| --- | --------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T1  | Feature doc + tracking                                                | —      | `odd/tasks/feature-recharts-charts.md`                                                                                                                                 | WU0    |
| T2  | `CashFlowChart` con recharts + test unitario + borrar el chart muerto | S1, S2 | `web/src/components/dashboard/CashFlowChart.tsx`, `web/src/components/dashboard/TopProductsChart.tsx`, `web/src/components/dashboard/__tests__/CashFlowChart.test.tsx` | WU1    |
| T3  | e2e actualizado al DOM de recharts + verificación en Chromium         | S3     | `web/e2e/buys-and-solds-flow.spec.ts`                                                                                                                                  | WU1    |
| T4  | Normalización Prettier del repo + `format:check` como gate            | S4     | repo-wide                                                                                                                                                              | WU2    |
| T5  | Smoke manual en navegador real + Log de cierre                        | S5     | —                                                                                                                                                                      | WU3    |

**Work units**:

- **WU1** — charts con recharts (código + tests + e2e).
- **WU2** — chore de formato, commit aislado.
- **WU3** — cierre (smoke + docs).

## Log

- **L1 (2026-10-19, pedido del usuario)**: "1. usa recharts en vez de graficos inline con svg." / "2. borra la branch si ya esta mergeada" / "3. si tiene sentido que esten normalizados, hazlo" / "4. hazlo" (smoke manual) / "5.-8. explicame el problema" (nits y limitaciones documentadas).
- **L2 (2026-10-19, spike antes de escribir código)**: con recharts 3.10.1 + React 19.3.1, un `LineChart` dentro de `StrictMode` renderiza bien en jsdom (test temporal, 1 passed). El crash que motivó el SVG inline en Fase 5 **no se reproduce** con la versión instalada hoy; el e2e en Chromium es el judge final. Si el e2e lo confirma, la causa original fue otra (o la versión cambió).
- **L3 (2026-10-19, alcance)**: `TopProductsChart` no lo importa nadie (`ProductsTab` lo eliminó en S8 de `dashboard-iteration-1`) → se borra en vez de portarlo. Solo queda un chart visible en la app: el `CashFlowChart`, usado por `OverviewTab` y `RevenueTab`.
- **L4 (2026-10-19, decisión sobre el formato)**: normalizar **sí** tiene sentido — con 64 archivos fuera de formato, `format:check` es ruido y el `.prettierrc.json` del repo no describe el código real. Pero el reformat es un diff grande (casi todo rewrap de líneas) que se mezcla con cualquier cambio de comportamiento: va en un commit chore aislado, y en adelante `format:check` es gate.
- **L5 (2026-10-19, desviación de la convención del repo)**: los charts con recharts se tematizan con variables CSS (`--color-chart-compras` / `--color-chart-ventas` en `@theme` de `index.css` + override en `.dark`) y con variantes arbitrarias de Tailwind 4 (`[&_.recharts-cartesian-grid_line]:…`). El SVG inline usaba `className="dark:stroke-…"`; recharts escribe atributos `stroke`/`fill` en elementos que genera, así que la vía es CSS.
