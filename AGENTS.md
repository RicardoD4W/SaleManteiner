# SaleManteiner — Contexto para agentes

> Resumen operativo del proyecto. Reemplaza al antiguo `CONTEXT.md`/`PLAN.md`. Última actualización: 2026-10-21.

## 0. Reglas no negociables

1. **Verificación visual antes de cerrar cualquier feature que afecte a la UI** (§8.1). Un test verde **no** es "se ve bien": hay que levantar la app, capturar las pantallas y **mirar las capturas**. El informe de cierre incluye las capturas revisadas. Si no se pudo mirar, el feature **no está cerrado** y se reporta como bloqueado. No hay excepciones por "es un cambio chico", "solo un texto" o "los tests pasan": un texto partido o una columna cortada son bugs igual que un test rojo.
   **Alcance**: aplica a los cambios que tocan la UI (textos, layout, estilos, componentes). Una spec **solo de código** (refactors, renombres, limpieza) que no cambia ni la funcionalidad ni el aspecto **no** la requiere: se verifica con los gates (typecheck, lint, format, tests). El arnés de capturas no vive en el repo: se crea en el momento de resolver la spec que lo necesita (ver §8.1).
2. **La BD del usuario no se toca.** Toda verificación (e2e, visual, scripts) corre contra una BD **temporal** (`SALEMANTEINER_DIR`), nunca `~/.salemanteiner`. Los datos que el usuario carga a mano son sacredos.
3. **Los gates antes de commitear**: `typecheck`, `lint`, `format:check` y los tests (unit + e2e) tienen que estar verdes. Si un gate no se puede correr, se dice; no se commitea a ciegas.

## 1. Qué es

App web **local** (React + Node) que registra y mantiene un histórico de ventas de tu cuenta de Wallapop. Pensada como un **tracker de profitability para reseller**: cargar ventas (con coste, precio, gastos, comprador, vendido sí/no) y ver si el negocio cierra números.

**Plan por fases** (3 fuentes previstas a futuro, pero el MVP arranca solo con manual):

1. **MVP (Fase 1)**: entrada **manual** únicamente, modelo de datos simplificado.
2. ~~**Evolución futura**: scraping no oficial de `api.wallapop.com` (riesgo ToS aceptado)~~ — **Descartado** por decisión del usuario (Log L6 de `odd/tasks/feature-buys-and-solds.md`). No hay código de scraping/proxy en el repo. Si se reactiva en el futuro, abrir feature doc nuevo.
3. **Evolución futura**: importación CSV desde el panel de Wallapop.

UI en **español únicamente** (sin i18n), fechas en `dd/MM/yyyy`.

## 2. Ubicación

- **Repo**: `G:\Data\vscode\react\Wallapop\SaleManteiner\` (aún no es un repo git — añadir git local cuando convenga).
- **Datos de runtime** (BD, sesión Wallapop): `~/.salemanteiner/` por defecto; configurable con `SALEMANTEINER_DIR`.

## 3. Stack

| Capa             | Tecnología                                               | Notas                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend         | React 19 + TypeScript + Vite 8 + Tailwind 4              | Tailwind 4 usa config en CSS (`@theme` en `src/index.css`), no `tailwind.config.js`. Plugin oficial `@tailwindcss/vite` integrado en `vite.config.ts`. Dark mode con `@custom-variant dark`. |
| Backend          | Node 20 LTS + Express 5 + TypeScript + better-sqlite3 13 |                                                                                                                                                                                              |
| Validación       | Zod 4 (schemas en backend, fuente única de tipos)        |                                                                                                                                                                                              |
| Logging          | Pino 10 + pino-http 11                                   |                                                                                                                                                                                              |
| Tests            | Vitest 5                                                 |                                                                                                                                                                                              |
| Linter / Formato | ESLint 10 + Prettier                                     | ESLint 10 usa flat config (`eslint.config.js` con `FlatCompat` para reusar presets legacy). Los antiguos `.eslintrc.cjs` ya no existen.                                                      |
| Gestor Node      | fnm                                                      | Cargar con `scripts/with-fnm.ps1`                                                                                                                                                            |
| Gestor paquetes  | npm workspaces (monorepo `web/` + `server/`)             |                                                                                                                                                                                              |

## 4. Estructura

```text
SaleManteiner/
├── package.json                 ← workspaces npm (root)
├── package-lock.json
├── agents.md                    ← este archivo
├── README.md
├── .editorconfig / .prettierrc.json / .prettierignore / .gitignore
├── server/                      ← backend Node + Express
│   ├── eslint.config.js         ← flat config (ESLint 10)
│   ├── package.json
│   ├── tsconfig.json
│   ├── scripts/copy-assets.mjs  ← copia migrations al dist en build
│   └── src/
│       ├── config.ts            ← rutas, puerto, log level
│       ├── logger.ts
│       ├── app.ts               ← crea la app Express, registra routers (buys/solds/customers/dashboard)
│       ├── index.ts             ← entrypoint (listen + shutdown limpio)
│       ├── db/
│       │   ├── index.ts         ← openDb (WAL+FK+mkdir)
│       │   ├── migrate.ts       ← runMigrations
│       │   └── migrations/      ← 001_initial.sql (legacy), 002_purchase_date_and_manual_sold_at.sql (legacy), 003_buys_and_solds.sql (nuevo modelo)
│       ├── lib/
│       │   └── round.ts         ← round2() helper, mitiga error IEEE 754
│       ├── schemas/
│       │   ├── common.ts        ← EuroMoney (z.number().nonnegative().multipleOf(0.01)), RowId, LocalDate, ShortText, LongText
│       │   ├── buys.ts          ← Buy, CreateBuyInput, UpdateBuyInput
│       │   ├── solds.ts         ← Sold, CreateSoldInput (con items), UpdateSoldInput, SoldWithItems
│       │   └── customers.ts     ← Customer, CreateCustomerInput, UpdateCustomerInput
│       ├── repo/
│       │   ├── buys-repo.ts     ← CRUD + getWithStock
│       │   ├── solds-repo.ts    ← CRUD + createManyWithStockCheck (transaccional) + statsDashboard
│       │   └── customers-repo.ts ← CRUD + search
│       ├── routes/
│       │   ├── health.ts
│       │   ├── buys.ts          ← /api/buys (CRUD + /stock)
│       │   ├── solds.ts         ← /api/solds (CRUD con validación de stock transaccional en POST)
│       │   ├── customers.ts     ← /api/customers (CRUD + search)
│       │   └── dashboard.ts     ← /api/stats/dashboard (KPIs nuevo modelo: compras_total_eur, ventas_total_eur, beneficio_total_eur, stock_pendiente_count + revenueByMonth + topProducts + topBuyers)
│       ├── __tests__/           ← buys, solds, customers, stock, stats-dashboard (109 tests con BD :memory:)
│       └── .agents/skills/      ← skills cargadas en server
└── web/                         ← frontend React + Vite
    ├── eslint.config.js         ← flat config (ESLint 10)
    ├── index.html               ← anti-FOUC dark mode script en <head>
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts           ← integra @tailwindcss/vite
    ├── playwright.config.ts     ← tests E2E (Playwright)
    └── src/
        ├── main.tsx             ← root + QueryClientProvider
        ├── App.tsx              ← RouterProvider (rutas: / = Dashboard, /buys/*, /solds/*, /dashboard/* con 4 tabs anidadas)
        ├── index.css            ← @import "tailwindcss" + @custom-variant dark + @theme (paleta brand, font)
        ├── vite-env.d.ts
        ├── api/                 ← buys.ts, solds.ts, customers.ts (mirror de server)
        ├── components/
        │   ├── ui/              ← Button, Input, Textarea, Card, Badge, Spinner (todos con dark:)
        │   ├── sales/           ← ProductPickerModal (multi-select), CustomerAutocomplete (creación inline)
        │   ├── dashboard/       ← RevenueChart, TopProductsChart, TopBuyersChart (SVG inline)
        │   └── layout/          ← Layout (con nav Dashboard · Compras · Ventas · + Nueva + ThemeToggle sol/luna), NavLink
        ├── hooks/               ← useBuys, useCreateBuy, useUpdateBuy, useDeleteBuy, useBuy, useBuysStock, useSolds, useCreateSold, useUpdateSold, useDeleteSold, useSold, useCustomers, useCreateCustomer, useStatsDashboard, useTheme
        ├── lib/                 ← format.ts (formatEuro, formatDate, todayLocalDate, localDateToISO), round.ts (round2), download.ts, queryClient.ts
        ├── pages/
        │   ├── buys/            ← BuysListPage, BuyNewPage, BuyEditPage
        │   └── solds/           ← SoldsListPage, SoldNewPage, SoldEditPage
        ├── pages/dashboard/     ← DashboardPage + OverviewTab + RevenueTab + ProductsTab + BuyersTab (adaptados al nuevo modelo con KPIs compras_total_eur, ventas_total_eur, beneficio_total_eur, stock_pendiente_count)
        ├── schemas/             ← buys.ts, solds.ts, customers.ts, common.ts (mirror de server, en euros decimales con EuroMoney = z.number().nonnegative().multipleOf(0.01))
        ├── test-utils/          ← fixtures.ts, render.tsx
        ├── e2e/                 ← Playwright specs (buys-and-solds-flow.spec.ts, dashboard-flow.spec.ts, create-flow.spec.ts, etc.)
        └── .agents/skills/      ← skills cargadas en web
├── desktop/                    ← shell de escritorio (Tauri 2) + sidecar con el server (§14)
│   ├── package.json            ← workspace npm con @tauri-apps/cli (tauri dev / build / icon)
│   ├── Cargo.toml / build.rs   ← proyecto Rust (deps: tauri, plugins shell/updater/process/log)
│   ├── tauri.conf.json         ← config del shell (ventana, bundle, CSP)
│   ├── capabilities/default.json ← permisos (core, updater, process, shell:allow-execute)
│   ├── src/                    ← main.rs (thin) + lib.rs (toda la lógica)
│   ├── icons/                  ← el set de íconos (generado con `tauri icon`)
│   └── .agents/skills/         ← skills cargadas en desktop (ver §9)
└── odd/                        ← docs del ODD
    ├── happy-path.md           ← guion de humo del usuario (el checklist de §8.1)
    └── tasks/                  ← un doc por feature (specs + tasks + log)
```

## 5. Decisiones de producto

| #   | Decisión                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Scraping no oficial** como fuente principal (riesgo de ToS aceptado por el usuario).                                                                                                                                                                                                                |
| D2  | Modelo **A+**: una sola llamada trae todo el catálogo (publicados + reservados + vendidos). Estado se asigna automático y se puede editar manual.                                                                                                                                                     |
| D3  | **Descartada** (la app no usaba proxy en MVP y el scraping de Wallapop se retiró del plan). Reemplazada por la decisión arquitectónica del feature `feature-buys-and-solds`: 4 tablas (`buys`, `solds`, `sale_items`, `customers`), importes en euros decimales en SQLite REAL con helper `round2()`. |
| D4  | Mini-login email+contraseña; 2FA manual la primera vez; cookies guardadas en `~/.salemanteiner/wallapop-session.json`.                                                                                                                                                                                |
| D5  | UI **solo español**, sin i18n. Fechas `dd/MM/yyyy`.                                                                                                                                                                                                                                                   |
| D6  | Nombre del proyecto: **SaleManteiner**.                                                                                                                                                                                                                                                               |
| D7  | Volumen esperado: **~50 ventas/mes** → SQLite local basta, paginación a 25.                                                                                                                                                                                                                           |
| D8  | Sincronización **manual** (sin `node-cron`). Botón "Sincronizar ahora" en la UI.                                                                                                                                                                                                                      |

## 6. Modelo de datos (buys + solds + customers)

4 tablas del feature `buys-and-solds` (S1 de `odd/tasks/feature-buys-and-solds.md`):

### Tabla `buys` (compras de producto)

| Campo              | Tipo             | Notas                                                                                 |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------- |
| `id`               | INTEGER PK       | autoincrement                                                                         |
| `product_name`     | TEXT NOT NULL    | nombre del producto                                                                   |
| `purchase_cost`    | REAL             | coste TOTAL pagado en euros decimales (se prorratea por unidad al calcular beneficio) |
| `quantity`         | INTEGER NOT NULL | unidades compradas (default UX 1)                                                     |
| `associated_costs` | REAL             | gastos envío/embalaje TOTALES en euros decimales (se prorratean por unidad)           |
| `purchase_date`    | TEXT             | `YYYY-MM-DD`, día local. Default hoy. Editable por el cliente.                        |
| `created_at`       | TEXT NOT NULL    | ISO 8601, automático (set en INSERT)                                                  |

Índices: `idx_buys_purchase_date`.

### Tabla `customers` (clientes)

| Campo        | Tipo          | Notas                |
| ------------ | ------------- | -------------------- |
| `id`         | INTEGER PK    | autoincrement        |
| `name`       | TEXT NOT NULL | nombre del cliente   |
| `created_at` | TEXT NOT NULL | ISO 8601, automático |

Índices: `idx_customers_name`.

### Tabla `solds` (ventas)

| Campo              | Tipo                                                | Notas                                                                  |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------------------------- |
| `id`               | INTEGER PK                                          | autoincrement                                                          |
| `customer_id`      | INTEGER NOT NULL FK→customers.id ON DELETE RESTRICT | el cliente no se puede borrar si tiene ventas                          |
| `sale_price`       | REAL                                                | precio TOTAL de la venta en euros decimales (no se prorratea por item) |
| `associated_costs` | REAL                                                | gastos envío/comisión TOTALES de la venta                              |
| `sold_at`          | TEXT                                                | `YYYY-MM-DD`, día local. Default hoy. Nullable.                        |
| `notes`            | TEXT NULL                                           | notas libres (solo en venta)                                           |
| `created_at`       | TEXT NOT NULL                                       | ISO 8601, automático                                                   |

Índices: `idx_solds_sold_at`, `idx_solds_customer`.

### Tabla `sale_items` (items de pack en una venta)

| Campo      | Tipo                                    | Notas                                             |
| ---------- | --------------------------------------- | ------------------------------------------------- |
| `sold_id`  | INTEGER FK → solds.id ON DELETE CASCADE | la venta padre                                    |
| `buy_id`   | INTEGER FK → buys.id ON DELETE RESTRICT | el buy no se puede borrar si tiene items vendidos |
| `quantity` | INTEGER NOT NULL                        | unidades vendidas de este buy (≥ 1)               |

PK compuesta: `(sold_id, buy_id)`. Una venta puede tener N items (pack multi-producto). Cada item referencia una compra distinta y una cantidad vendida.

Índices: `idx_sale_items_buy` (lookup de "ya vendido?" — el más frecuente, lo usa la modal en cada apertura), `idx_sale_items_sold` (detalle de venta).

### Reglas del repo

- **Importes en euros decimales** (SQLite REAL). Validación Zod: `z.number().nonnegative().multipleOf(0.01)` (`EuroMoney` en `server/src/schemas/common.ts`).
- **Helper `round2()`** (en `server/src/lib/round.ts` y `web/src/lib/round.ts`) para mitigar error IEEE 754 en operaciones aritméticas. Se aplica en toda suma/resta/multiplicación de importes.
- **Validación de stock transaccional** (S7): `POST /api/solds` se ejecuta dentro de `db.transaction()`. Lee stock disponible de cada `buy_id`, valida cobertura, INSERT en `solds` + INSERTs en `sale_items`. Si no cubre → rollback + 422 con `{ error: 'Stock insuficiente', items: [{ buy_id, product_name, disponibles, solicitado }] }`.
- **`created_at`** se setea en el INSERT (no se acepta del cliente).
- **`purchase_date` y `sold_at`** las gestiona el cliente. El server **respeta siempre el input**: si el cliente los manda, pisa; si no, conserva el valor existente; `null` explícito borra.
- **Coste de compra = TOTAL pagado**: el form pide el total; el backend guarda `purchase_cost` total + `quantity` y calcula el unitario con `round2(buy.purchase_cost / buy.quantity)` cuando hace falta (cálculo de beneficio, listado de stock).
- **Beneficio por venta** (S13): la fórmula vive en la **vista SQL** `v_sold_costs` (migración `004_vistas_cifras.sql`), que es la **única** fuente de la verdad: `sale_price - associated_costs - cogs_purchase - cogs_associated`, con el coste prorrateado por unidad en la vista `v_item_costs` (`ROUND(coste_compra / cantidad, 2) * cantidad`). Ojo: usa el `ROUND` de **SQLite**, no el `round2` de JS → en un empate exacto de 3 decimales (p. ej. 0,70 € entre 4 unidades) puede diferir **1 céntimo** del `round2` de JS. Es el comportamiento que ya tenía el SQL de antes (no es un cambio del feature) y ahora está pineado en `server/src/__tests__/vistas-cifras.test.ts`.
- **Prorrateo en packs** (S8, topProducts): `si.quantity * (s.sale_price / total_qty_de_la_venta)` para que el revenue se reparta entre los items del pack (sin over-count).

Refs: `odd/tasks/feature-buys-and-solds.md` S1-S13.

## 7. Fases del proyecto

| Fase                          | Estado          | Descripción                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** Andamiaje               | ✅              | Monorepo `web/` + `server/`, Vite + TS, ESLint, Prettier, scripts de setup, README.                                                                                                                                                                                                                                  |
| **1** Backend MVP + BD + CRUD | 🔁 sustituida   | Sustituida por `feature-buys-and-solds.md` (T1-T7). El código legacy `sales` se reemplaza por `buys + solds + sale_items + customers` en WU1 backend.                                                                                                                                                                |
| **2** Frontend MVP manual     | 🔁 sustituida   | Sustituida por `feature-buys-and-solds.md` (T8-T11). UI pasa de `/sales/*` a `/buys/*` y `/solds/*`; modal multi-select; autocomplete de clientes con creación inline.                                                                                                                                               |
| **3** Importación CSV         | ❌ descartada   | Descartada junto con la Fase 4 (Log L6 del feature doc). Se reactiva en feature futuro si hace falta. No hay código de import en este feature.                                                                                                                                                                       |
| **4** Scraping Wallapop       | ❌ descartada   | Descartada por el usuario (Log L6). Riesgo ToS aceptado pero no implementado. No hay código de proxy ni de scraping en el repo.                                                                                                                                                                                      |
| **5** Dashboard               | 🔁 sustituida   | Sustituida por T12 del feature (KPIs del nuevo modelo + nueva tab "Compradores"). Mantiene las 3 tabs existentes (Resumen/Ingresos/Productos) adaptadas al nuevo esquema.                                                                                                                                            |
| **6** Exportación CSV         | ❌ descartada   | Descartada junto con la Fase 3. Se reactiva en feature futuro si hace falta.                                                                                                                                                                                                                                         |
| **7** Settings + cifrado      | ⏸️ en pausa     | Queda pausada: el cifrado de un token que no existe (Fase 4 descartada) no aplica. Se reactiva si en el futuro aparece otro dato sensible para cifrar.                                                                                                                                                               |
| **8** Pulido + E2E + docs     | ✅ (2026-10-19) | Cerrada con el feature `phase-8-polish-e2e-docs`: 6 e2e nuevos (editar/borrar compra+venta, dark mode toggle, tabs dashboard), README.md y AGENTS.md sincronizados con el estado real del proyecto. Refs: `odd/tasks/feature-phase-8-polish-e2e-docs.md`. Sin trabajo orgánico pendiente hasta el próximo cambio UX. |

**Estimación total**: 5–6 días de trabajo real (no consecutivos).

## 8. Cómo arrancar

```powershell
# 1) Asegurar Node 20+ (fnm recomendado)
fnm install 20   # solo la primera vez
fnm use 20

# 2) Instalar deps (solo la primera vez)
npm install

# 3) Arrancar todo (server en :4000 + web en :5173)
npm run dev
```

URLs:

- Frontend → <http://localhost:5173>
- Backend → <http://localhost:4000/api/health>

Comandos útiles:

- `npm run typecheck` — TS en `web/` y `server/`
- `npm run lint` — ESLint en ambos
- `npm run format` / `format:check` — Prettier. **Desde 2026-10-19 el repo está normalizado con Prettier y `format:check` es un gate** (si falla, el cambio no entra).
- `npm run test` / `npm run test:e2e` — tests unitarios de los dos workspaces y la suite E2E (ver §0.3).
- `npm run dev:desktop` / `npm run build:desktop` — el shell de escritorio (Tauri). **Requiere Visual Studio Build Tools** (ver §14).
- **Verificación visual** (ver §8.1): el arnés no vive en el repo, se arma en el momento de resolver la spec que lo necesita.

### 8.1 Verificación visual (NO NEGOCIABLE — ver §0.1)

Un test verde no es lo mismo que "se ve bien". Antes de dar por cerrado un feature que **afecta a la UI**, hay que **mirar la web**.

El guion de humo del usuario (crear un cliente, modificarlo, hacer una compra, venderla, borrarla...) está en **`odd/happy-path.md`**: es el checklist que hay que recorrer para comprobar que un refactor no rompió nada.

**El arnés no vive en el repo**: se crea en el momento de resolver la spec que lo necesita (y se puede borrar después, cuando la spec está resuelta). Un spec que **solo toca código** (refactor, renombres, limpieza) sin cambiar la funcionalidad ni el aspecto **no** lo necesita: lo verifican los gates.

Cómo se arma (si hay que reconstruirlo) — **fuera del repo**, en el directorio temporal:

- Un script que levante su propio backend (p. ej. `PORT=4310 SALEMANTEINER_DIR=<tmp>`) y su propio Vite (`--port 5310`, con `API_TARGET` apuntando a ese backend), con una BD **temporal** (nunca toca `~/.salemanteiner`).
- Siembra datos realistas por la API: acentos (`Lucía Fernández`), un pack de 2 productos, una venta con poco margen y otra con beneficio **negativo**.
- Captura con el Chromium del repo (`@playwright/test`): dashboard, compras, ventas, clientes, los modales, la página de edición, **dark mode** y **móvil** (390px). Registra los errores de consola: un error de runtime no se ve en una captura, pero sí lo detecta ese paso.
- Para congelar una transición en el aire: CDP (`Animation.setPlaybackRate` con `playbackRate: 0.05`) y capturar en pleno vuelo.
- Las capturas se **miran** con la herramienta `read` (renderiza el PNG como imagen). Esto es lo que atrapa lo que ningún test ve: una columna que se sale de la tabla, un texto partido, un color sin contraparte `dark:`, un modal que tapa el contenido, un chart que quedó en su fallback de carga.

Qué mira cada captura (el checklist, en `web/.agents/skills/visual-verification/SKILL.md`):

- La pantalla que cambió, la misma en **dark mode**, la misma en **móvil** (390px) y los modales que abre.
- Lo que ningún test ve: columna cortada, texto partido, chart en su fallback de carga, modal que tapa el contenido, color sin contraparte `dark:`.

Reglas (no negociables, §0.1):

1. El cierre de un feature con UI incluye **las capturas revisadas** en el informe (qué se vio y si algo quedó mal).
2. Si no se pudo mirar, se dice explícitamente: **el feature no está cerrado** y el resultado es "bloqueado por falta de verificación visual", no "cerrado con un pendiente".
3. Lo que se mira es justo lo que los tests no ven: columna cortada, texto partido, chart en su fallback, modal que tapa el contenido, color sin contraparte `dark:`, versión móvil rota.
4. Para flujos interactivos puntuales (clics, teclado, consola, red) está el MCP de Playwright; el repo ya tiene Chromium instalado (`npx playwright install chromium`) y se puede usar el Playwright del repo directamente desde un script.

## 9. Skills cargadas

Las skills de cada workspace viven en `<workspace>/.agents/skills/<nombre>/SKILL.md`.

### Regla de evaluación por prompt (OBLIGATORIA, en cada pedido)

En **cada** pedido del usuario hay que evaluar **explícitamente** si el cambio toca algo que una skill cubre, y esa evaluación va **antes** de la primera lectura o edición del workspace:

1. Listar las skills candidatas del workspace que se va a tocar (con el mapa de abajo).
2. Decidir skill por skill: **cargar** o **no cargar**, dejando el motivo.
3. **En caso de duda → cargar.** Una skill de más cuesta una lectura; una de menos cuesta un error que la skill habría prevenido. La duda nunca es motivo para saltear.
4. Cargar el `SKILL.md` **antes** de la primera lectura o edición del workspace, y también sus `references/*.md` si la regla general aplica al cambio.
5. La evaluación es **por pedido**, no una sola vez por sesión: si el pedido cambia de área (un modal, un schema, el server, los tests, el diseño), se re-evalúa.
6. Dejar en el informe del turno qué skills se cargaron y cuáles se descartaron, con el motivo. Si no se dice nada, se asume que no se evaluó.

### Mapeo de skills por workspace (ruta completa)

**`server/.agents/skills/`** (cargar antes de tocar `server/**`):

- `server/.agents/skills/zod/SKILL.md` — schemas Zod, validaciones, refinements, parse (`safeParse`, `flatten`, `multipleOf`, `brand`, etc.).
- `server/.agents/skills/typescript-advanced-types/SKILL.md` — tipos utilitarios, branded types, generics, narrowing.
- `server/.agents/skills/vitest/SKILL.md` — tests Vitest: fixtures, helpers, mocking, organización.

**`web/.agents/skills/`** (cargar antes de tocar `web/**`):

- `web/.agents/skills/react-best-practices/SKILL.md` — performance de React (Vercel rules: waterfalls, bundle, memo, derived state, hydration).
- `web/.agents/skills/composition-patterns/SKILL.md` — APIs de componentes, evitar boolean prop proliferation, compound components, state lifting.
- `web/.agents/skills/typescript-advanced-types/SKILL.md` — tipos utilitarios, branded types, generics.
- `web/.agents/skills/vite/SKILL.md` — `vite.config.ts`, plugins, build, dev server, env vars.
- `web/.agents/skills/tailwind-css-patterns/SKILL.md` — utilities, responsive design, dark mode (`@custom-variant dark`), `@theme`, accesibilidad visual.
- `web/.agents/skills/accessibility/SKILL.md` — WCAG 2.2, ARIA, focus management, contraste, target size, lenguaje, labels, errores. **Cargar ante cualquier cambio de modal, diálogo, foco, teclado o formulario** (el `Escape`, el foco inicial y el orden de tabulación son territorio suyo).
- `web/.agents/skills/frontend-design/SKILL.md` — jerarquía visual, spacing, tipografía, layout, atomic design. **Cargar ante cambios de UI visibles**, no solo de lógica.
- `web/.agents/skills/visual-verification/SKILL.md` — el checklist de verificación visual (qué mirar y en qué orden: la pantalla que cambió, dark mode, móvil, los modales). **Cargar en toda feature con UI** (ver §8.1).
- `web/.agents/skills/seo/SKILL.md` — meta tags, OG, JSON-LD. NO aplica a esta SPA salvo que se reactive SSR.

**`desktop/.agents/skills/`** (cargar antes de tocar `desktop/**`):

- `desktop/.agents/skills/tauri-v2/SKILL.md` — Tauri v2: `tauri.conf.json`, comandos Rust (`#[tauri::command]`), IPC (`invoke`/`emit`/channels), **capabilities y permisos**, updater y distribución, sidecars. **Cargar ante cualquier cambio en `desktop/**`** (la config, el shell Rust, el bundling y el updater son territorio suyo). Sus `references/`: `capabilities-reference`, `ipc-patterns`, `plugin-reference` (**los strings exactos de permisos** de cada plugin), `updater-distribution` (firma, HTTPS y publicación) y `advanced-runtime` (sidecars, tray, deep links).
- `desktop/.agents/skills/rust-best-practices/SKILL.md` — Rust idiomático (Apollo GraphQL): ownership/borrowing, `Result` en vez de `panic`, clippy, performance, error handling, tests y documentación. **Cargar antes de escribir o revisar código Rust** (los 9 capítulos de `references/` son el deep-dive).

**Criterio para `desktop/`** (el mismo de `web/` y `server/`, o sea la regla de evaluación por prompt de arriba): si el pedido toca `desktop/**`, se listan estas dos skills, se decide **cargar / no cargar** dejando el motivo, y **en caso de duda se carga**. Dos matices:

- `tauri-v2` se carga siempre que se toque la config, el shell, las capabilities o el updater. Si el pedido es solo de **packaging** (el script que arma el sidecar) o de documentación, se puede seguir sin ella → pero si ese script define rutas o nombres que el shell usa, la `tauri-v2` es la que dice cuáles (`externalBin`, el sufijo del target triple, los permisos).
- `rust-best-practices` se carga solo si se escribe o revisa **código Rust**. No hace falta para tocar el `Cargo.toml` (dependencias) ni el JSON de configuración.

### Reglas duras

1. **SIEMPRE** cargar las skills relevantes **antes** de la primera lectura o edición de un archivo del workspace.
2. Las skills se leen con `read` apuntando a la ruta completa del SKILL.md (ej. `web/.agents/skills/tailwind-css-patterns/SKILL.md`).
3. Si la skill tiene `references/*.md` cuya regla general aplica al cambio, leer también las references — no solo el SKILL.md raíz.
4. Al delegar a un subagent del workspace, el task que se le pasa debe incluir la lista de skills relevantes a leer primero (no asumir que el subagent las descubre solo).
5. Si una skill contradice la intuición técnica, gana la skill (es la convención del repo).
6. Si al cargarla queda claro que no aplica, no pasa nada: se anota el descarte. No se "descarga" a mitad de camino.

### Cuándo NO cargar una skill

- Tareas puramente de git (commits, branches, merge) y documentación que no toca código (`AGENTS.md`, `README.md`, `odd/tasks/`).
- Búsqueda global de strings en el repo (`grep`/`find`), salvo que el resultado requiera editar archivos del workspace.
- Skills que el propio SKILL.md declara fuera de alcance (ej. `seo` en esta SPA: es una SPA sin SSR).

### Convención de dark mode (Tailwind 4)

La estrategia usa `@custom-variant dark` (clase-based), ya configurado en `web/src/index.css`. El toggle, el anti-FOUC y la persistencia ya están integrados en el Layout (S1-S5 de `odd/tasks/feature-dark-mode.md`). Los componentes solo necesitan agregar `dark:` a sus clases siguiendo la convención de abajo.

**Reglas**:

- Mobile-first: base = light, agregar `dark:` para el equivalente oscuro.
- **NUNCA** usar colores hardcodeados sin contraparte dark. Si ves `bg-gray-100` sin `dark:bg-gray-800`, agregá la contraparte.
- **NO** usar `darkMode: 'media'` (eso desactiva el toggle). Solo `'class'`.
- **Anti-FOUC**: el script inline en `index.html` aplica la clase `dark` antes del primer paint. Si agregás un nuevo entry point, mantenelo.
- **Default**: si no hay nada en `localStorage`, respetar `prefers-color-scheme`; si tampoco hay match, arrancar en dark.
- **Persistencia**: clave `salemanteiner-theme` en `localStorage`, valores `"light"` | `"dark"`.

**Tokens canónicos** (no inventar variantes). Cada fila es UN rol: si el mismo color aparecía con dos tonos distintos, se unificó en el par de esta tabla.

| Light                             | Dark                     | Uso                                   |
| --------------------------------- | ------------------------ | ------------------------------------- |
| `bg-white`                        | `dark:bg-gray-900`       | tarjetas, header, sidebar             |
| `bg-gray-50`                      | `dark:bg-gray-950`       | wrapper de página (layout background) |
| `bg-gray-50`                      | `dark:bg-gray-800`       | filas alternadas, hover de items      |
| `text-gray-900`                   | `dark:text-gray-100`     | texto principal                       |
| `text-gray-700`                   | `dark:text-gray-300`     | texto secundario (labels, valores)    |
| `text-gray-500`                   | `dark:text-gray-400`     | texto auxiliar (hints, placeholders)  |
| `text-gray-400`                   | `dark:text-gray-500`     | íconos y punteros                     |
| `border-gray-200`                 | `dark:border-gray-800`   | bordes de cards, header, divider      |
| `border-gray-300`                 | `dark:border-gray-700`   | bordes de inputs, botones secundarios |
| `bg-red-50`                       | `dark:bg-red-950/30`     | fondo de error (alerts)               |
| `text-red-700`                    | `dark:text-red-400`      | texto de error y pérdida              |
| `text-red-400`                    | `dark:text-red-200`      | total gastado (KPI de compras)        |
| `bg-emerald-100` / `bg-green-100` | `dark:bg-emerald-900/30` | fondo badge success                   |
| `text-emerald-800`                | `dark:text-emerald-300`  | texto success (beneficio positivo)    |
| `text-orange-500`                 | `dark:text-orange-400`   | valor cero o neutro                   |
| `text-yellow-600`                 | `dark:text-yellow-400`   | aviso de stock bajo                   |
| `text-blue-400`                   | `dark:text-blue-300`     | KPI informativo                       |
| `text-brand-600`                  | `dark:text-brand-400`    | link de acción                        |

**SVG / charts**: los `fill="#..."` y `stroke="#..."` hardcodeados se mantienen como fallback. Agregar `className="dark:fill-... dark:stroke-..."` que Tailwind traduce a `.dark\:fill-... { fill: ... }` con CSS specificity que sobreescribe el atributo. Patrón aplicado en `web/src/components/dashboard/CashFlowChart.tsx`.

**Focus visible en dark**: el `ring-offset` debe ser sobre el fondo oscuro del contenedor. Ej: `focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`.

Referencia: `odd/tasks/feature-dark-mode.md` (S1-S10) y la skill `web/.agents/skills/tailwind-css-patterns/SKILL.md` (sección "Dark Mode Issues").

Reglas Zod aplicadas al esquema legacy `sales` (se mantienen las mismas reglas en los schemas nuevos `Buy`/`Sold`/`Customer` salvo donde se indica): `schema-use-enums` (no aplica, no hay enums), `schema-string-validations` (ShortText/LongText), `schema-use-unknown-not-any`, `parse-use-safeparse`, `parse-validate-early`, `parse-never-trust-json`, `type-use-z-infer`, `type-export-schemas-and-types`, `error-use-flatten`, `error-custom-messages`, `object-strict-vs-strip` (`.strict()` en inputs), `object-optional-vs-nullable` (`.optional()` en input, `.nullable()` en output), `refine-defaults` (`.default()` solo en create, NO en update — ver "Decisión: defaults en create vs update" abajo), `parse-handle-all-issues` (varios errores, no solo el primero), `perf-cache-schemas` (schemas a nivel de módulo), `type-input-vs-output` (test usa `parse()` para construir el output). El feature nuevo **sustituye `type-branded-types` (Cents/RowId)** por importes en euros decimales sin marca + helper `round2()` para mitigar el error IEEE 754 (Spec S2 del feature).

### Decisión: defaults en create vs update (importante)

**Create** (`CreateSaleInput`): campos monetarios y `sold` usan `.default(0)` / `.default(false)`. Ausencia = "usá el default" (skill `refine-defaults`).

**Update** (`UpdateSaleInput`): los mismos campos usan `.optional()` (NO `.default()`). Ausencia = "no cambiar". **No se puede usar `CreateSaleInput.partial()`** porque el default de create se aplicaría también en el parse del PATCH y "no enviar cost_cents" terminaría pisando el valor existente a 0. Por eso `UpdateSaleInput` está definido a mano con `.optional()` en cada campo.

El repo, en `update()`, filtra los `undefined` antes de hacer spread sobre el `existing` para no pisar valores que el patch no menciona.

## 10. Riesgos abiertos

> Las filas de esta sección referencian scraping de Wallapop + proxy + JWT, que el **feature actual descarta por completo** (Fase 4 retirada del plan, ver Log L6 de `odd/tasks/feature-buys-and-solds.md`). Quedan solo como referencia histórica hasta que se reactive; si se reactiva el scraping en el futuro, las mitigaciones vuelven a aplicar.

| Riesgo                                | Estado / mitigación                                |
| ------------------------------------- | -------------------------------------------------- |
| Wallapop banea la cuenta por scraping | Descartado (no se implementa scraping). No aplica. |
| Wallapop cambia `api.wallapop.com`    | Descartado. No aplica.                             |
| Baneo de IP por rate                  | Descartado. No aplica.                             |
| JWT expira                            | Descartado. No aplica (no hay login automatizado). |
| Proxy deja de funcionar               | Descartado. No aplica.                             |
| Captcha / fingerprinting              | Descartado. No aplica.                             |

## 11. Fuera de alcance

Subir fotos, chat con compradores, publicar productos, multi-cuenta, push móvil, sync entre dispositivos, app móvil nativa.

## 12. Próximo paso inmediato

**Estado actual**: el modelo `buys + solds + sale_items + customers` está activo en `master` (y también el refactor de limpieza + la auditoría de calidad, ver §13). La app tiene **cuatro vistas** en el header (Dashboard · Compras · Ventas · Clientes) y el borrado vive **en las tablas** (no en las páginas de edición), con doble confirmación cuando el registro tiene ventas asociadas.

Cerrados en esta tanda (2026-10-21, **pusheados a `origin/master`**):

- `feature-acciones-en-listas` — el borrado desde las tablas con modales compartidas (`ConfirmDeleteModal`, `DeleteBuyModal`, `DeleteDialogs`), el indicador de orden en la misma línea que la cabecera y la view transition de elemento compartido al editar. Refs: `odd/tasks/feature-acciones-en-listas.md`.
- `feature-clientes-crud` — vista de Clientes (alta, edición y borrado en cascada, en el server y en el web). Refs: `odd/tasks/feature-clientes-crud.md`.
- La tanda de pulido de UI (cursor, view transition con todos los campos, link del header y orden del picker): 5 commits desde `9a1341d`.

**Verificación de la tanda**: 176 server + 209 web tests + 32/32 e2e + 0 typecheck/lint/format, verificación visual (18 capturas mirada, incluida `08b-transicion-en-vuelo` que congela la transición para ver los chips en el aire) y **verificadores independientes** de las dos unidades de riesgo (borrado en cascada de compras y de clientes): sin bloqueantes en ninguna.

**Próximo paso inmediato**: la app está en `master` y en `origin/master`. Opcional: un smoke manual de los flujos en `localhost:5173` (los e2e y las capturas cubren lo principal).

**En curso (2026-10-23)**: el feature `componentizar-y-optimizar` (la deuda técnica de la auditoría: una fuente de la verdad, menos código y optimizar) está **cerrado y commiteado** en la rama `feature/componentizar-y-optimizar` (todo por encima de `master`), con los gates verdes y la verificación visual hecha. **Falta la decisión del usuario**: revisar la rama y decidir si se mergea a `master` (o se deja como PR). Refs: `odd/tasks/feature-componentizar-y-optimizar.md` (Log L6 y L10 cuentan los dos bugs que encontró: la validación del cliente que nunca se veía, y el `happy-path.md` que faltaba).

**En curso (2026-10-25)**: la **app de escritorio** (spec: `odd/tasks/feature-app-de-escritorio.md`, rama `feature/app-de-escritorio`). El destinatario es **no técnico**: se le entrega un instalador con un icono y la app **arranca sola** (sin Node, sin terminal) y **se actualiza sola** (no maneja git). Ya está: el "un solo origen" (el server sirve el `web/dist` con fallback de SPA) y el workspace `desktop/` con el CLI de Tauri. Falta: el shell de Tauri (**bloqueado hasta que termine de instalar Visual Studio Build Tools**), el sidecar, el instalador y el auto-update. Ver §14.

Decisiones que quedaron pendientes (no bloquean nada):

1. **Smoke manual opcional** de los flujos en `localhost:5173` cuando se quiera validar UX de los features cerrados. Sin fecha límite.
2. **El borrado en cascada no tiene undo.** El server deja audit trail (log Pino con el id y las ventas afectadas) y la UI avisa "Esta acción no se puede deshacer", pero no hay soft-delete ni papelera. **Riesgo asumido explícitamente por el usuario** al cerrar el feature `delete-cascade-and-ux-polish` (Log L11 de su feature doc): es una decisión de producto, no una deuda abierta. Lo mismo aplica al borrado en cascada de clientes (2026-10-21).
3. **La vuelta desde el formulario por el logo del header no arma la fila** (la id del registro no puede viajar en el `state` de esa navegación): esa vuelta degrada a cross-fade. Solo afecta a la view transition, no a la funcionalidad.
4. **La paginación en el server** (decidido el 2026-10-23, es lo que hace escalar de verdad): hoy `GET /api/buys` y `GET /api/solds` devuelven **toda la historia** → a 50 ventas/mes, 8 años son 4.800 ventas ≈ **1,35 MB** que el navegador baja, parsea, filtra y ordena en cada tecla (la tabla ya está virtualizada; el problema son los datos, no el DOM). El spec está en `odd/tasks/feature-paginacion.md` (con las mediciones y el orden de las tareas). **Ojo con el orden**: el fix de la vista de las cifras (S2 del spec) es **prerrequisito** de la paginación, porque `v_sold_costs` materializa el COGS de todas las ventas antes de filtrar → sin ese fix, cada página pagaría el historial entero.
5. **El ordenamiento tiene una sola mecánica** (2026-10-23): las 5 tablas usan el hook `useSortable` (el `SortingState` y el `getSortedRowModel` de TanStack se fueron: TanStack quedó solo para el layout de columnas y la virtualización). La regla vive en `web/src/lib/sorting.ts` (nulos primero, números como números, textos en español; y la primera dirección siempre ascendente) y la cabecera en `<SortableTh>` (clic, teclado, `aria-sort`, `scope="col"` y el indicador). **Ojo con TanStack v8.21**: su `sortingFn` recibe las **filas**, no los valores (`sortingFn(rowA, rowB, columnId)`) → si se usa, hay que extraer el valor con `row.getValue(columnId)`.
6. **La firma del instalador** (decisión del usuario, 2026-10-25): el instalador se lo pasa a mano al cliente, **sin Microsoft Store**. Firmarlo (certificado OV, desde ~129 USD/año) quita el "editor desconocido" pero **no** garantiza que desaparezca el aviso de SmartScreen (desde 2026 las EV tampoco dan reputación inmediata) → la vía suave sin Store es **instalar en la máquina del cliente**. La firma del **updater** (minisign) es gratis y va sí o sí. Ver §14.
7. **Un bug visual abierto** (2026-10-25): en **móvil (390px)** la leyenda del chart del dashboard envuelve a 2 líneas y **pisa la etiqueta del eje Y** ("60 €" queda tapada por "Resultado del mes"). La causa es `<Legend height={36}>` en `web/src/components/dashboard/CashFlowChart.tsx`: reserva 36 px y a ese ancho la leyenda necesita 2 líneas. El arreglo (reservar más alto o achicar la fuente en móvil) es una decisión de UI: está en la spec del escritorio como pendiente, no se tocó el código.
8. **La revisión nativa (RDD) hay que volver a intentarla** (2026-10-23): en esta máquina `gentle-ai review assess` devuelve `package-local-binary-missing` (el binario no está) → `nativeRisk: unassessable` y no se pudo hacer la revisión nativa. **La próxima vez: intentarla de nuevo y, si sigue sin funcionar, avisarle al usuario y dejarlo todo documentado** (qué se intentó, qué devolvió y con qué quedó cubierto: los gates + la verificación visual + un verificador independiente).

## 13. Notas recientes

- **(2026-10-25) La app de escritorio: Tauri + sidecar, con el cliente en el centro.** El requisito es literal: **"es para un cliente muy torpe con la tecnologia, quiero que sea facil y tenga un icono que le de click y se ejecute solo"**. Eso descarta las opciones baratas (un acceso directo o una PWA exigen Node o un server en marcha en la máquina del cliente) y deja a **Tauri 2 + el server como sidecar** (instalador de 30-40 MB, el backend sin reescribir). Las decisiones y los requisitos están en **§14**; el spec, las tareas y el historial están en `odd/tasks/feature-app-de-escritorio.md`. Lo que ya está: el **"un solo origen"** (el server sirve el `web/dist` con fallback de SPA, y **el contrato de la API no cambia**) y el workspace `desktop/`.

- **(2026-10-25) La suite del web tarda 3× menos (25,86 s → 8,62 s) y aparecieron dos bugs que nadie sabía.** `web/vitest.config.ts` ahora usa `pool: 'vmThreads'` (el jsdom se crea **una vez por worker** en vez de una vez por archivo) y `maxWorkers: 5` (la recomendación del `vitest doctor`; 6 núcleos físicos). `isolate: false` quedó **descartado**: es más rápido pero filtra los `vi.mock` entre archivos y rompe `src/lib/__tests__/toast.test.ts` según el orden. Al medir aparecieron **dos bugs preexistentes**: (1) el warm-up del chart lazy heredaba el `hookTimeout` de 10 s y reventaba con la caché fría ("Hook timed out in 10000ms") → ahora tiene 60 s; (2) el test de `totals12m` del server fijaba un beneficio de **19,5**, un número calculado a mano **que nunca se ejecutó** (el commit `b47f2e7` lo dice) → el correcto es **25** (lo confirman el KPI, `totals12m`, el mes y la fórmula de §6). Verificación: **275/275 web + 205/205 server + 36/36 e2e**, y **31 capturas revisadas a ojo** (el happy path entero + edge cases: validación, cascada 409, 422 de stock, beneficio negativo, móvil 390px, teclado y foco). De esa revisión visual salió **un bug abierto** (la leyenda del chart en móvil, punto 7 de §12).

- **(2026-10-25) La suite del web tarda 3× menos y dejó de ser flaky.** `web/vitest.config.ts` ahora fija `pool: 'vmThreads'` y `maxWorkers: 5`. Antes (pool por defecto `forks` + `isolate: true`) **cada uno de los 35 archivos de test creaba su propio jsdom**: Vitest avisaba _"jsdom was created 35 times · 280 s total, 68% of tracked time"_. Con `vmThreads` el jsdom se crea **una vez por worker** y cada archivo recibe un contexto VM nuevo → el aislamiento por archivo se mantiene (importante: el web usa `vi.mock` 127 veces en 19 archivos, así que `isolate: false` está **descartado**: filtra mocks entre archivos y rompe `src/lib/__tests__/toast.test.ts` según el orden de ejecución). `maxWorkers: 5` es la recomendación del propio `vitest doctor` (la máquina tiene 6 núcleos físicos; con menos workers se compite menos por el servidor de Vite). **Medido sobre el suite real** (mismo comando, 12 corridas): 25,86 s (mediana del baseline) → 9,60 s (solo `vmThreads`) → **8,62 s** (con `maxWorkers: 5`, con una varianza de 0,12 s entre corridas). Para volver a medir: `npx vitest doctor` dentro de `web/` (compara `threads`/`vmThreads`/`vmForks`/`happy-dom`/`isolate: false`/`maxWorkers` y **valida el aislamiento barajando el orden de los archivos**). El **server no necesita nada**: su entorno es `node` (sin DOM) y el doctor recommends "keep the current configuration" (el mejor candidato, `isolate: false`, solo gana un 7% y a costa del aislamiento).
  - **Dos bugs que aparecieron al medir** (los dos preexistentes, ninguno lo causó el cambio): (1) `web/src/components/dashboard/__tests__/LazyCashFlowChart.test.tsx` fallaba de forma intermitente con _"Hook timed out in 10000ms"_: su `beforeAll` es un **warm-up** que precarga `../CashFlowChart` (para que el `findByTestId(..., { timeout: 5000 })` del test 2 no expire) y heredaba el `hookTimeout` de 10 s, insuficiente para transformar `recharts` con la caché de Vite fría → ahora el warm-up tiene su propio plazo de 60 s. (2) `server/src/__tests__/stats-dashboard.test.ts` fijaba `totals12m.beneficio` en **19,5**, un número calculado a mano **que nunca se ejecutó** (el commit `b47f2e7` lo dice: _"los tests NO se ejecutaron"_): el valor correcto es **25**, que es lo que dan el KPI, `totals12m` y el mes con la misma fixture.
  - Ojo: `web/vitest.config.ts` **no está en el typecheck** (`web/tsconfig.json` incluye solo `src`, y `web/tsconfig.node.json` solo `vite.config.ts`).

- **(2026-10-23) La deuda técnica de la auditoría, cerrada: una fuente de la verdad, menos código y un bug de validación que nadie sabía.** El feature `componentizar-y-optimizar` (spec: `odd/tasks/feature-componentizar-y-optimizar.md`, en la rama `feature/componentizar-y-optimizar`) atacó los 11 puntos de la auditoría de calidad. Lo que cambió:
  - **Una sola fuente de la verdad**: las cifras del dashboard salen de **vistas SQL** (`v_item_costs` y `v_sold_costs`, migración 004) en vez de la fórmula de prorrateo escrita 6 veces y la de beneficio 3 veces; los forms del web derivan de un schema compartido (`web/src/schemas/fields.ts` + `forms.ts`) en vez de redeclarar (y divergir) sus reglas; el `buildResolver` a mano del modal de cliente desapareció (ahora `zodResolver`).
  - **Más código**: un `<Modal>` para los 6 modales (con el foco y el Escape unificados), un módulo de `armedRow` para la fila armada de `/buys` y `/solds` (80 líneas duplicadas), y un hook de cascada (`useCascadeDeleteFlow`) para compras, ventas y clientes (la misma máquina de estados estaba escrita dos veces).
  - **El orden de las tablas, con una sola regla** (el punto 8 de la auditoría, cerrado por partes el 2026-10-23): el comparador vive en `web/src/lib/sorting.ts` (nulos primero, números como números, textos en español con los dígitos en su lugar) y la cabecera ordenable en `<SortableTh>` (clic, teclado, `aria-sort`, `scope="col"` y el indicador) → **las 5 tablas ordenan igual**. Antes: TanStack ordenaba los acentos al final ("Álvaro" después de "ana"), las columnas numéricas arrancaban en descendente y en `/buys` y `/solds` no se podía ordenar con el teclado. Las dos mecánicas (TanStack y `useSortable`) siguen existiendo por debajo, pero ya no se notan.
  - **Optimizado**: los índices se **midieron** con `EXPLAIN QUERY PLAN` (se fueron 3 que el planner no podía usar y el filtro por cliente pasó de SCAN a SEARCH), el SQL se prepara una vez (el `better-sqlite3` no cachea) y el borrado en cascada ya no relee el registro (TOCTOU).
  - **Un bug que nadie sabía**: **la validación del cliente nunca se veía**. El `<input type="number" step="0.01" min="0">` hacía que el navegador bloqueara el envío con su validación nativa, así que la validación de Zod no corría nunca: el usuario veía el cartel del navegador (en el idioma del navegador) y nunca el mensaje de la app. El fix fue `noValidate` en los forms: ahora **el schema es la única validación**. Además el schema del web tiene la misma regla que el server (un nombre o producto de solo espacios no es válido, y la fecha tiene que existir en el calendario).
  - Los errores de los forms ahora se **anuncian** (`role="alert"`), que antes no importaba porque no se veían.
  - Verificación: typecheck, lint, format:check, **201 tests server + 268 web + 36 e2e** y **18 capturas revisadas a ojo** (los 6 modales, el dashboard, las listas, dark mode y móvil). La revisión nativa (RDD) no pudo correr: el binario no está en esta máquina; en su lugar, un **verificador independiente** (solo lectura) sobre las dos unidades de riesgo: sin bloqueantes, y sus 3 hallazgos corregidos (la migración 004 editada después de aplicada → ahora hay una 005; un 409 que se perdía en un recurso sin cascada; y el AGENTS.md alineado con el `ROUND` de SQLite de la vista).
  - **Queda fuera de este feature**: el punto 8 de la auditoría (los dos mecanismos de ordenamiento: el `SortingState` de TanStack en 3 tablas y el hook `useSortable` en el dashboard y `/customers`). Es el más grande de los 11 y quedó anotado como posible feature aparte.

- **(2026-10-23) Refactor de limpieza + auditoría de calidad (mergeados a `master`).** El repo pasó un barrido completo: **cero comentarios** en el código (solo directivas funcionales de eslint), **identificadores en inglés**, **código muerto fuera** (`Badge`, `CardHeader`, `customersApi.search`, `setLight`/`setDark`, los helpers legacy del modelo en céntimos, `papaparse`/`postcss`/`autoprefixer`/`eslint-plugin-react(-refresh)`), **dependencias implícitas declaradas** (`zod` en web, `@eslint/js`, `@eslint/eslintrc`) y la **duplicación unificada** (`repo/types.ts`, `routes/_shared.ts`, `definedOnly`, `apiErrorMessage`, `errorAlertClass`, `ErrorState`, `SortableTableHead`, `StatCard`, `invalidate`, el tipo del 409). De paso se corrigieron **bugs reales**: el KPI **"Beneficio" del dashboard mostraba el signo invertido** (el server mandaba `neto = compras − ventas` y la tab lo pintaba como beneficio: si ganabas, salía rojo y negativo); **al guardar una venta la página de edición reventaba** (la respuesta del `PATCH`, sin items, pisaba la caché del detalle: intermitente y invisible para los e2e); React se quejaba de **claves duplicadas** en la lista de productos del dashboard (la clave era el _nombre_); la suite **E2E no era idempotente** (no borraba clientes) y podía escribir en la **BD real del usuario** si `SALEMANTEINER_DB` estaba exportada. Los **tokens de color** quedaron unificados (un par por rol) y la tabla canónica de §9 al día. Las **skills (`.agents/`) ahora están versionadas** (§9 las declara obligatorias y no llegaban a un clone nuevo) y hay **icono de la app** (`web/public/favicon.svg`: antes el `index.html` apuntaba a un archivo inexistente → 404). El guion de humo del usuario quedó en **`odd/happy-path.md`** (15 pasos recorridos por la UI, 28 capturas revisadas). Verificación: typecheck, lint, format:check, 202 tests web + 194 server + 33/33 e2e.

- **(2026-10-22) El relevo de la transición: el dato no parpadea y la caja se asienta en su sitio.** El chip (el texto que viaja) vive en el overlay de la view transition y el input real vive en el DOM, debajo: por eso el valor se apagaba antes de llegar (fade-out del browser) y, al terminar la transición, el chip desaparecía de golpe y el input aparecía de golpe (el valor "parpadeaba": 100% → 0 → 100%). Ahora el relevo es un cross-fade DENTRO del overlay: en el último tramo del vuelo (~12%) el chip se disuelve Y la foto del input aparece, así que las dos capas se cruzan y el valor nunca baja de opacidad 1 (medido: la suma de las dos opacidades es 1.00 durante todo el relevo). La duración de la transición se declara explícita (`--dur-transition: 250ms`) porque el chip y la caja tienen que compartir la línea de tiempo. Capturas: `08c-relevo-campos` (el relevo) y `08b-transicion-en-vuelo` (los chips en vuelo, a opacidad completa).
- **(2026-10-22) El dato que viaja a la página de editar ya no se desvanece.** El browser hace un fade-out de la foto vieja mientras vuela, así que el valor se apagaba justo antes de aterrizar en el campo y no se veía "llegar" el dato (lo reportó el usuario con dos capturas). Ahora la foto del texto viaja a opacidad COMPLETA (`@keyframes chip-arrives` en `index.css`, con keyframes constantes a propósito: el fade default queda desactivado sin importar cuánto dure la transición) y recién al final la reemplaza el input real, que ya está en su sitio. El arnés visual suma `08c-dato-llegando`: congela la transición a 1/20 de velocidad por CDP y captura el dato ya aterrizado, a opacidad completa.
- **(2026-10-22) Bug del picker de productos en la venta nueva.** "Cancelar" en el picker **INICIAL** (el primer paso de "+ Nueva venta") te dejaba en el formulario de venta sin productos: no se podía ni enviar (falta el producto) ni cerrar sin otro click. Ahora cancelar ahí cancela la **venta entera** y cierra la modal. El picker de "+ Cambiar productos" se comporta como debe: cancelar vuelve al formulario conservando lo elegido. El picker ahora sabe **por qué** se abrió (`pickerReason`: `'initial' | 'change' | null`) en vez de un booleano `showPicker`. Verificación: 211 tests web + 176 server + 33/33 e2e + typecheck/lint/format limpios y verificación visual (19 capturas, incluida `05c-form-nueva-venta`: el formulario de venta, que el arnés no capturaba).
- **(2026-10-21) Tanda de pulido de UI (4 pedidos del usuario).** (1) **Puntero del ratón en "Borrar"/"Editar"**: la causa era el preflight de **Tailwind 4**, que ya no pone `cursor: pointer` en los `<button>` (en v3 lo hacía): los links "Editar" mostraban la manita por defecto del navegador y los botones "Borrar" la flecha. Arreglado en el `Button` compartido y en los botones de fila de `/buys`, `/solds` y `/customers`. (2) **View transition de editar**: los valores de la fila viajan como _chips de texto_ (uno por campo editable) hasta los inputs del formulario, sin deformarse: en `/buys` viajan producto, coste, cantidad, asociados y fecha; en `/solds`, cliente, precio, asociados y fecha. El CSS está en `web/src/index.css` (clases `.vt-cell` / `.vt-box` + `view-transition-class`). Ojo: **Chrome le pone a los DOS pseudo-elementos del grupo la clase del elemento de DESTINO** de la navegación (por eso las reglas de CSS están separadas por sentido: ida → `box`, vuelta → `cell`). (3) **El link "Dashboard" del header sigue iluminado** en las tabs del dashboard (Ingresos/Productos/Compradores): con `end` solo se activaba en `/`; ahora las rutas viven en `web/src/lib/dashboardTabs.ts` (fuente única para las tabs y para el link del header). (4) **Picker de productos**: al reabrirlo con "+ Cambiar productos", lo que ya está marcado sale ARRIBA del todo; el orden se congela al abrir (tildar/destildar no reordena la lista, para que la fila bajo el puntero no se escape). Verificación: 209 tests web + 176 server + 32/32 e2e, typecheck/lint/format limpios y **verificación visual con las 18 capturas revisadas** (el arnés tiene ahora `01b-dashboard-tab-ingresos` y `05b-picker-orden` —que pinean los puntos 3 y 4— y `08b-transicion-en-vuelo`, que congela la transición a 1/20 de velocidad por CDP para poder VER los chips en el aire).
- **(2026-10-21) La verificación visual pasa a ser NO NEGOCIABLE (AGENTS.md §0).** El usuario pidió "literalmente veas la web y compruebes sobre la web si funciona o no". Quedó el arnés (`npm run visual -w web` → 15 capturas en `web/visual/shots/`, que se miran con la herramienta `read`) y la regla en §0: un feature con UI no está cerrado sin las capturas revisadas. El primer uso ya encontró dos cosas que ningún test detectaba (la columna "Acciones" de `/solds` cortada, y el chart del dashboard capturado en su fallback de carga).
- **(2026-10-21) Tanda cerrada: `acciones-en-listas` + `clientes-crud`.** El borrado de compras y ventas pasó de las páginas de edición a las tablas (con modales compartidas: `ConfirmDeleteModal`, `DeleteBuyModal`, `DeleteDialogs`) y el de clientes, con su vista nueva en el header (alta, edición y borrado en cascada, con el 409 en el server y la cascada transaccional con audit trail). Además: el indicador de orden se queda en la misma línea que la cabecera, y al editar la fila de la tabla viaja al formulario (view transition de elemento compartido). Verificación: 176 server + 198 web + 31/31 e2e, typecheck/lint/format limpios, verificación visual y **verificadores independientes** de las dos unidades de riesgo (0 bloqueantes).
- **(2026-10-19) Feature `delete-cascade-and-ux-polish` mergeado y pusheado.** 10 commits a `origin/master` (WU1-WU9 del feature + el fix de dashboard que estaba pendiente de `01a3565`). Cierra el gap de calidad que la review había detectado: el contrato HTTP del borrado de compras ahora está pinneado por tests de rutas y por un e2e del flujo 409 → modal → cascada, y el guard 409 del web ya no puede fallar en silencio. Verificación: 140 server + 78 web + 15/15 e2e, con verificación independiente del commit de riesgo (0 bloqueantes).
- **(2026-10-19) Cierre del feature `delete-cascade-and-ux-polish`.** `DELETE /api/buys/:id` ya no da 500 cuando la compra tiene ventas asociadas: devuelve 409 con la lista de ventas y la UI abre una modal de confirmación; `DELETE /api/buys/:id/cascade` borra la compra y limpia las ventas (en pack, solo quita su item; si la venta queda vacía, la borra) con audit trail en el log. Además: columna "Productos" en `/solds`, `times_sold` por unidades vendidas, view transitions en toda la navegación, sort inicial en idle y el autocomplete de clientes que se contrae al perder el foco. Verificación: 135 server + 78 web + 15/15 e2e. Refs: `odd/tasks/feature-delete-cascade-and-ux-polish.md`.
- **(2026-10-19) Cierre de Fase 8 (Pulido + E2E + docs).** Feature `phase-8-polish-e2e-docs` cerrado: 6 e2e nuevos agregados a `web/e2e/buys-and-solds-flow.spec.ts` (13 totales vs 7 previos) + `README.md` reescrito para reflejar el estado real del proyecto (no más "migración en curso") + §7 marca la Fase 8 como ✅. El proyecto queda en estado "MVP manual cerrado y operativo". Verificación al cierre del feature: 113 server + 70 web + 13 e2e verdes.
- **(2026-10-19) Cierre de features `buys-and-solds` + `dashboard-iteration-1`.** T15 del feature doc formalizado: AGENTS.md §12 deja de apuntar a "arrancar WU1 backend" (WU1-WU4 ya commiteados) y pasa a apuntar al push pendiente + cleanup opcional. El estado del proyecto es: features cerradas, tests verdes, working tree limpio.
- **(2026-10-16) `openDb` crea el directorio padre de la BD** si no existe (`mkdirSync({ recursive: true })`). Antes crasheaba con `TypeError: Cannot open database because the directory does not exist` cuando `SALEMANTEINER_DIR` apuntaba a un directorio nuevo. Cubierto por 3 tests en `server/src/db/index.test.ts` (cubren `:memory:` + file-based + creación recursiva del dir). El feature doc de Fase 2 ahora usa `$env:TEMP\salemanteiner-smoke` como ejemplo portable.
- **(2026-10-19) Persistencia BD en `~/.salemanteiner/` por defecto.** El server usa `~/.salemanteiner/data.db` via `os.homedir()` (configurable con `SALEMANTEINER_DIR` / `SALEMANTEINER_DB`). La "decisión pendiente" que figuraba en §12 quedó cerrada por código: `server/src/config.ts` ya implementa este path default. `openDb` crea el directorio padre si no existe.
- **(2026-10-19) Schemas Zod sin duplicación server/web en el feature `buys-and-solds`.** Ambos lados usan **euros decimales** (`EuroMoney = z.number().nonnegative().multipleOf(0.01)`). El form ya no convierte a céntimos — esa nota era del modelo legacy `sales`. La duplicación del schema (mismo Zod en server y web) sigue siendo deliberada: defensa en profundidad + evitar un monorepo `shared/` que complique el build. Si surge la voluntad de unificar, el refactor es bounded (los schemas están en `server/src/schemas/` y `web/src/schemas/` y son archivos chicos).
- **(2026-10-19) Tests Vitest del frontend web.** 70 tests en 11 archivos (no los 99 que figuran en notas previas — se ajustaron al modelo `buys/solds`). Cubren schemas/formatters/api-client/api-wrapper/hooks-de-mutación/Button+Badge/SalesTable/KpiCards. La "Fase 8 (Pulido + E2E + docs)" sigue pendiente: añadir más E2E con Playwright o Vitest Browser cuando haya cambios UX nuevos. Hoy los 7 e2e cubren el flujo principal.
- **(2026-10-16) Pivote del MVP**: el plan original tenía scraping + CSV + manual; el usuario simplificó el MVP a manual únicamente. El scraping queda como evolución futura (Fase 4, retirada).

## 14. La app de escritorio (Tauri)

**Qué es**: un shell de escritorio que **empaqueta la app sin reescribirla**. El web compilado (`web/dist`) y el server (`server/dist`) viajan dentro del instalador; el shell (Tauri 2) abre la ventana y el server corre como **sidecar** (un proceso Node que el shell lanza y cierra).

- **Spec, tareas y Log**: `odd/tasks/feature-app-de-escritorio.md`. Rama: `feature/app-de-escritorio`.
- **Estructura**: `desktop/` es un **workspace npm** (como `web/` y `server/`) con `@tauri-apps/cli`; el proyecto Rust vive **plano en `desktop/`** (`Cargo.toml`, `tauri.conf.json`, `capabilities/`, `src/`, `icons/`).

### Decisiones (2026-10-25)

| Decisión                      | Qué implica                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Un solo origen**            | El server sirve el `web/dist` con fallback de SPA (`server/src/app.ts`) → el web y la API viven en el mismo origen, y el shell apunta a una sola URL. **El contrato de la API no cambia**: `/api/*` igual, y lo que no existe sigue dando 404 JSON.                                                                                                                                                                                   |
| **La BD en la ruta estándar** | `%LOCALAPPDATA%\SaleManteiner\data.db` (Windows), `~/Library/Application Support/` (macOS), `$XDG_DATA_HOME/` (Linux). Se respetan `SALEMANTEINER_DIR`/`SALEMANTEINER_DB`, y **si la ruta nueva está vacía pero existe el `~/.salemanteiner/data.db` de siempre, se usa el viejo** → nadie pierde datos.                                                                                                                              |
| **Entrega manual**            | El instalador NSIS (~40 MB) lo pasa el usuario a mano al cliente. **Sin Microsoft Store.**                                                                                                                                                                                                                                                                                                                                            |
| **Auto-update**               | El cliente **no maneja git**: la app se actualiza sola. La firma del updater es con **minisign** (`tauri signer generate`): **gratis y obligatoria** (Tauri no deja desactivar el updater). La clave **pública** va en `tauri.conf.json`; la **privada nunca se comparte**. Hay que publicar los instaladores en un endpoint (GitHub Releases o `/updates` propio).                                                                   |
| **Firma de Windows**          | Es **otra** firma, aparte del updater. Sin firmar, Windows muestra _"Windows te protegió tu PC"_ → "Más información → Ejecutar". Con un certificado OV (desde ~129 USD/año) el editor aparece con nombre, pero **no** garantiza que desaparezca el aviso (desde 2026 las EV **tampoco** dan reputación inmediata). La vía suave sin Store es **instalar en la máquina del cliente**: si el archivo no viene descargado, no hay aviso. |

### Requisitos (verificados en esta máquina el 2026-10-25)

1. **Visual Studio Build Tools 2022** con el workload _"Desarrollo para el escritorio con C++"_ → **el linker** (`cl.exe`). Instalado en `G:\DevTools\Visual Studio` (MSVC 14.51) → `cargo build` funciona.
2. **Rust**: `rustc` **1.99.1** (había 1.87, y `tauri` 2.12 exige **≥ 1.90** → hizo falta `rustup update`).
3. **WebView2 Runtime**: ya viene en Windows 10/11 (aquí 155.0.4283.62) → Tauri **no** lo empaqueta ni lo descarga.
4. **Node**: para construir (ya está) y **para el sidecar** → el instalador lo lleva dentro (el cliente **no** instala Node).
5. **Firma**: un certificado OV si se quiere firmar el ejecutable (decisión pendiente, §12.6) y **la clave minisign del updater** (gratis).

### Estado verificado

- `cargo build` → `desktop/target/debug/salemanteiner-desktop.exe` ✓ (con el toolchain y el linker).
- `npx tauri build --debug` → **`desktop/target/debug/bundle/nsis/SaleManteiner_0.1.0_x64-setup.exe`** (4,18 MiB **sin** el sidecar: con Node + server + web serán ~40 MB) ✓.
- Los **iconos** salen del favicon del repo (`web/public/favicon.svg` → `tauri icon`).
- **No** hacen falta los paquetes JS `@tauri-apps/api` ni `@tauri-apps/plugin-*`: el shell conduce todo desde Rust y el web no llama a la API de Tauri.

### El auto-update (decidido)

- **Claves minisign**: la **privada** está en `~/.salemanteiner/desktop-updater/updater.key` (**fuera del repo**) con su password en `password.txt` al lado; la **pública** va en `tauri.conf.json` (`plugins.updater.pubkey`). Si se pierde cualquiera de las dos, **no se pueden firmar más updates**.
- **Para firmar un build**: `TAURI_SIGNING_PRIVATE_KEY_PATH` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` en el entorno → el bundler firma los artefactos y genera el `.sig` que el updater verifica.
- **El endpoint** apunta a las GitHub Releases (`releases/latest/download/latest.json`) → cada release tiene que publicar el instalador **y** el `latest.json`.
- La **firma de Windows** (Authenticode) es **otra** cosa y sigue pendiente de decidir (§12.6): sin ella, el cliente ve el aviso de SmartScreen.

### Cómo se construye y cómo se prueba

- `npm run build:web` + `npm run build:server` → los dos artefactos que viaja el sidecar.
- `npm run dev:desktop` → el shell en modo desarrollo.
- `npm run build:desktop` → el instalador en `desktop/target/release/bundle/nsis/` (con `--debug` va a `target/debug/`).
- **T7 (el smoke que de verdad valida el requisito)**: instalar en una máquina **sin Node** → doble clic en el icono → la app abre, guarda datos y **se actualiza sola**.
