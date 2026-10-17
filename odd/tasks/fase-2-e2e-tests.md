# Fase 2 — Tests E2E del frontend

> Feature document. Tests end-to-end con Playwright que validan los flujos de usuario completos contra el backend real.

## Contexto

Los 99 tests unit/integration del frontend (cubren componentes, hooks, schemas, API wrapper) verifican unidades aisladas. Falta validar que la app completa funciona: browser real + backend real + flujos de usuario. Esto cierra el gap que hoy cubre solo el smoke manual.

El usuario decidió en sesión 2026-10-16 seguir el principio "tests de la mano con el desarrollo" también para E2E. Esto se ejecuta retroactivamente sobre Fase 2 implementada.

## Stack

| Paquete                                        | Rol                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `@playwright/test`                             | Runner E2E + browser automation                                     |
| Chromium (descargado via `playwright install`) | Único browser para empezar; Firefox/WebKit quedan para más adelante |

Solo Chromium por ahora para mantener el setup chico. Si hace falta cross-browser se agrega después.

## Estructura nueva

```
web/
├── playwright.config.ts        ← webServer que arranca backend + Vite dev
├── e2e/
│   ├── fixtures.ts             ← helpers (createSaleViaUI, expectKpis, etc.)
│   ├── empty-state.spec.ts     ← / sin ventas
│   ├── create-flow.spec.ts     ← crear una venta end-to-end
│   ├── edit-flow.spec.ts       ← editar precio, ver cambio reflejado
│   ├── delete-flow.spec.ts     ← borrar, ver KPIs actualizados
│   └── kpis-update.spec.ts     ← KPIs reflejan operaciones
└── package.json                ← scripts: e2e, e2e:headed
```

## Specs

### S1 — Configuración

- `web/playwright.config.ts` con:
  - `testDir: './e2e'`
  - `timeout: 30_000` (E2E son lentos)
  - `fullyParallel: true` (cada test corre con su propia DB)
  - `reporter: 'list'` (legible en consola)
  - `webServer: [{ command, port: 4000 }, { command, port: 5173 }]` con `reuseExistingServer: !process.env.CI`
  - `use: { baseURL: 'http://localhost:5173' }`
- `SALEMANTEINER_DIR` apuntando a un subdir de `os.tmpdir()` único por test (worker), para que cada test arranque con BD limpia.
- Backend arrancado con `npm --workspace server run dev` (tsx watch). Vite arrancado con `npm --workspace web run dev`.
- Scripts en `web/package.json`:
  - `"e2e": "playwright test"`
  - `"e2e:headed": "playwright test --headed"`
  - `"e2e:install": "playwright install chromium"` (descarga el browser)

### S2 — Fixture helpers

`web/e2e/fixtures.ts` exporta:

- `test` (re-export del de Playwright) con un `beforeEach` que limpia la BD y espera a que el server esté listo.
- `seedSales(page, sales: SaleInput[])` — crea ventas via UI (o via API directa para setup rápido — evaluar).
- `gotoHome(page)` — navega a `/` y espera a que termine el loading.
- `expectKpis(page, expected: { total, sold, ... })` — verifica los 7 KPIs.

### S3 — Empty state

`web/e2e/empty-state.spec.ts`:

- BD vacía.
- Visita `/`, ve el CTA "No hay ventas todavía" + link "Crear la primera →".
- Click en el link → navega a `/sales/new`.

### S4 — Create flow

`web/e2e/create-flow.spec.ts`:

- BD vacía.
- Visita `/sales/new`.
- Llena producto "iPhone 12", coste "150", precio "250", marca el checkbox "Ya lo vendí".
- Click "Crear venta".
- Espera a redirigir a `/`.
- Ve la fila con el producto, los importes formateados, y el badge "Sí".
- El KPI "Total" muestra 1, "Beneficio neto" muestra la diferencia.

### S5 — Edit flow

`web/e2e/edit-flow.spec.ts`:

- BD con una venta (seed).
- Visita `/`.
- Click en el producto (link a `/sales/:id`).
- Cambia el precio de venta a "300".
- Click "Guardar cambios".
- Espera a redirigir a `/`.
- Ve el nuevo precio formateado (300,00 €) en la fila.

### S6 — Delete flow

`web/e2e/delete-flow.spec.ts`:

- BD con 2 ventas (seed).
- Visita `/sales/1` (la página de edición).
- Click en "Eliminar" (o el botón que esté en `DeleteSaleButton`).
- Confirma el diálogo (si hay).
- Espera a redirigir a `/`.
- Solo queda 1 fila.
- El KPI "Total" muestra 1.

### S7 — KPIs update

`web/e2e/kpis-update.spec.ts`:

- BD con 2 ventas (1 vendida, 1 pendiente).
- Visita `/`. Verifica los KPIs iniciales.
- Crea una tercera venta (vendida) via UI.
- Verifica que "Total", "Vendidas", "Ingresos", "Beneficio neto" reflejan los nuevos valores.

### S8 — Verificación

- `npm run e2e` corre los 5 tests y termina con código 0.
- Los tests son independientes (cada uno limpia su BD).
- `tsc --noEmit` y `eslint` siguen OK con los nuevos archivos.

## Tasks

1. **T1** — Instalar `@playwright/test` + descargar Chromium via `npx playwright install chromium`.
2. **T2** — Crear `web/playwright.config.ts` + scripts en `web/package.json`.
3. **T3** — Crear `web/e2e/fixtures.ts` (helpers + DB cleanup).
4. **T4** — Test empty state (S3).
5. **T5** — Test create flow (S4).
6. **T6** — Test edit flow (S5).
7. **T7** — Test delete flow (S6).
8. **T8** — Test KPIs update (S7).
9. **T9** — Verificación completa: e2e + tsc + lint (S8).

## Verificación

```powershell
npm --workspace web run e2e
# 5 tests deben pasar en <60s total
```

## Deuda técnica

- Solo Chromium (no Firefox/WebKit).
- Sin screenshot diffing (no hay baseline; agregar después si aparece regresión visual).
- Sin tests de accesibilidad automatizados (axe-core queda para Fase 8).
- Sin tests de performance / network throttling.
- Sin CI configurado (los tests corren local; integración a CI queda como follow-up).

## Log

- **L1** (2026-10-16, usuario): "los tests van de la mano con el desarrollo y se irán actualizando corrigiendo o ampliando dependiendo del punto del desarrollo en el que estemos". El usuario eligió "Playwright E2E con browser" sobre las otras opciones (smoke-fetch / diferir).
- **L2** (2026-10-16): Stack fijado: `@playwright/test` + Chromium. Sin Firefox/WebKit por ahora. Cada test usa `SALEMANTEINER_DIR` único para aislar la BD.
