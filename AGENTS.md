# SaleManteiner — Contexto para agentes

> Resumen operativo del proyecto. Reemplaza al antiguo `CONTEXT.md`/`PLAN.md`. Última actualización: 2026-10-16.

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
- **Beneficio por venta** (S13): `round2(sold.sale_price - sold.associated_costs - sum(item.quantity * round2(buy.purchase_cost / buy.quantity)) - sum(item.quantity * round2(buy.associated_costs / buy.quantity)))`.
- **Prorrateo en packs** (S8, topProducts): `si.quantity * (s.sale_price / total_qty_de_la_venta)` para que el revenue se reparta entre los items del pack (sin over-count).

Refs: `odd/tasks/feature-buys-and-solds.md` S1-S13.

## 7. Fases del proyecto

| Fase                          | Estado        | Descripción                                                                                                                                                               |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** Andamiaje               | ✅            | Monorepo `web/` + `server/`, Vite + TS, ESLint, Prettier, scripts de setup, README.                                                                                       |
| **1** Backend MVP + BD + CRUD | 🔁 sustituida | Sustituida por `feature-buys-and-solds.md` (T1-T7). El código legacy `sales` se reemplaza por `buys + solds + sale_items + customers` en WU1 backend.                     |
| **2** Frontend MVP manual     | 🔁 sustituida | Sustituida por `feature-buys-and-solds.md` (T8-T11). UI pasa de `/sales/*` a `/buys/*` y `/solds/*`; modal multi-select; autocomplete de clientes con creación inline.    |
| **3** Importación CSV         | ❌ descartada | Descartada junto con la Fase 4 (Log L6 del feature doc). Se reactiva en feature futuro si hace falta. No hay código de import en este feature.                            |
| **4** Scraping Wallapop       | ❌ descartada | Descartada por el usuario (Log L6). Riesgo ToS aceptado pero no implementado. No hay código de proxy ni de scraping en el repo.                                           |
| **5** Dashboard               | 🔁 sustituida | Sustituida por T12 del feature (KPIs del nuevo modelo + nueva tab "Compradores"). Mantiene las 3 tabs existentes (Resumen/Ingresos/Productos) adaptadas al nuevo esquema. |
| **6** Exportación CSV         | ❌ descartada | Descartada junto con la Fase 3. Se reactiva en feature futuro si hace falta.                                                                                              |
| **7** Settings + cifrado      | ⏸️ en pausa   | Queda pausada: el cifrado de un token que no existe (Fase 4 descartada) no aplica. Se reactiva si en el futuro aparece otro dato sensible para cifrar.                    |
| **8** Pulido + E2E + docs     | ✅ (2026-10-19) | Cerrada con el feature `phase-8-polish-e2e-docs`: 6 e2e nuevos (editar/borrar compra+venta, dark mode toggle, tabs dashboard), README.md y AGENTS.md sincronizados con el estado real del proyecto. Refs: `odd/tasks/feature-phase-8-polish-e2e-docs.md`. Sin trabajo orgánico pendiente hasta el próximo cambio UX.                              |

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
- `npm run format` / `format:check` — Prettier

## 9. Skills cargadas

Las skills de cada workspace viven en `<workspace>/.agents/skills/<nombre>/SKILL.md`. Antes de leer o escribir cualquier archivo de un workspace, **SIEMPRE** se carga el `SKILL.md` de cada skill relevante y sus `references/*.md` si la regla general aplica al cambio. Esto NO es opcional.

### Mapeo de skills por workspace

**`server/.agents/skills/`** (cargar antes de tocar `server/**`):

- `zod/SKILL.md` — schemas Zod, validaciones, refinements, parse (`safeParse`, `flatten`, `multipleOf`, `brand`, etc.).
- `typescript-advanced-types/SKILL.md` — tipos utilitarios, branded types, generics, narrowing.
- `vitest/SKILL.md` — tests Vitest: fixtures, helpers, mocking, organización.

**`web/.agents/skills/`** (cargar antes de tocar `web/**`):

- `react-best-practices/SKILL.md` — performance de React (Vercel rules: waterfalls, bundle, memo, derived state, hydration).
- `composition-patterns/SKILL.md` — APIs de componentes, evitar boolean prop proliferation, compound components, state lifting.
- `typescript-advanced-types/SKILL.md` — tipos utilitarios, branded types, generics.
- `vite/SKILL.md` — `vite.config.ts`, plugins, build, dev server, env vars.
- `tailwind-css-patterns/SKILL.md` — utilities, responsive, dark mode (`@custom-variant dark`), `@theme`, accesibilidad visual.
- `accessibility/SKILL.md` — WCAG 2.2, ARIA, focus management, contraste, target size, lenguaje, labels, errores.
- `seo/SKILL.md` — meta tags, OG, JSON-LD. NO aplica a esta SPA salvo que se reactive SSR.
- `frontend-design/SKILL.md` — jerarquía visual, spacing, tipografía, layout, atomic design.

### Reglas duras

1. **SIEMPRE** cargar las skills relevantes **antes** de la primera lectura o edición de un archivo del workspace.
2. Las skills se leen con `read` apuntando a la ruta del SKILL.md (path relativo al repo, ej: `web/.agents/skills/tailwind-css-patterns/SKILL.md`).
3. Si la skill tiene `references/*.md` cuya regla general aplica al cambio, leer también las references — no solo el SKILL.md raíz.
4. Al delegar a un subagent del workspace, el task que se le pasa debe incluir la lista de skills relevantes a leer primero (no asumir que el subagent las descubre solo).
5. Si una skill contradice la intuición técnica, gana la skill (es la convención del repo).

### Cuándo NO cargar una skill

- Tareas puramente de git (commits, branches, merge).
- Búsqueda global de strings en el repo (`grep`/`find`), salvo que el resultado requiera editar archivos del workspace.
- Trabajo en `odd/tasks/` (es un directorio de docs, no toca código de runtime).

### Convención de dark mode (Tailwind 4)

La estrategia usa `@custom-variant dark` (clase-based), ya configurado en `web/src/index.css`. El toggle, el anti-FOUC y la persistencia ya están integrados en el Layout (S1-S5 de `odd/tasks/feature-dark-mode.md`). Los componentes solo necesitan agregar `dark:` a sus clases siguiendo la convención de abajo.

**Reglas**:

- Mobile-first: base = light, agregar `dark:` para el equivalente oscuro.
- **NUNCA** usar colores hardcodeados sin contraparte dark. Si ves `bg-gray-100` sin `dark:bg-gray-800`, agregá la contraparte.
- **NO** usar `darkMode: 'media'` (eso desactiva el toggle). Solo `'class'`.
- **Anti-FOUC**: el script inline en `index.html` aplica la clase `dark` antes del primer paint. Si agregás un nuevo entry point, mantenelo.
- **Default**: si no hay nada en `localStorage`, respetar `prefers-color-scheme`; si tampoco hay match, arrancar en dark.
- **Persistencia**: clave `salemanteiner-theme` en `localStorage`, valores `"light"` | `"dark"`.

**Tokens canónicos** (no inventar variantes):

| Light                             | Dark                     | Uso                                   |
| --------------------------------- | ------------------------ | ------------------------------------- |
| `bg-white`                        | `dark:bg-gray-900`       | tarjetas, header, sidebar             |
| `bg-gray-50`                      | `dark:bg-gray-950`       | wrapper de página (layout background) |
| `bg-gray-50`                      | `dark:bg-gray-800`       | filas alternadas, hover de items      |
| `text-gray-900`                   | `dark:text-gray-100`     | texto principal                       |
| `text-gray-700`                   | `dark:text-gray-300`     | texto secundario (labels, valores)    |
| `text-gray-500`                   | `dark:text-gray-400`     | texto auxiliar (hints, placeholders)  |
| `border-gray-200`                 | `dark:border-gray-800`   | bordes de cards, header, divider      |
| `border-gray-300`                 | `dark:border-gray-700`   | bordes de inputs, botones secundarios |
| `bg-red-50`                       | `dark:bg-red-950/30`     | fondo de error (alerts)               |
| `text-red-700`                    | `dark:text-red-400`      | texto de error                        |
| `bg-emerald-100` / `bg-green-100` | `dark:bg-emerald-900/30` | fondo badge success                   |
| `text-emerald-800`                | `dark:text-emerald-300`  | texto badge success                   |

**SVG / charts**: los `fill="#..."` y `stroke="#..."` hardcodeados se mantienen como fallback. Agregar `className="dark:fill-... dark:stroke-..."` que Tailwind traduce a `.dark\:fill-... { fill: ... }` con CSS specificity que sobreescribe el atributo. Patrón aplicado en `web/src/components/dashboard/RevenueChart.tsx` y `TopProductsChart.tsx`.

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

**Estado actual**: el modelo `buys + solds + sale_items + customers` está activo y commiteado en `master` (ramas `feature/buys-and-solds` y `feature/dashboard-iteration-1` mergeadas). El modelo legacy `sales` se dropeó en la migración 003. Sin Features vivos en curso. Verificación consolidada al cierre de los features: 113 server + 70 web tests + 7/7 e2e + 0 typecheck/lint. Refs: `odd/tasks/feature-buys-and-solds.md` (T1-T16 cerrados) + `odd/tasks/feature-dashboard-iteration-1.md` (T1-T21 cerrados).

**Próximo paso inmediato**: **push a `origin/master`** — la rama local está 13 commits ahead de `origin/master`. Cuando quieras: `git push origin master` (o PR si preferís review antes). Cleanup opcional después: borrar las branches locales mergeadas (`feature/buys-and-solds`, `feature/dashboard-iteration-1`, `feature/dark-mode`) con `git branch -d`.

Decisiones que quedaron pendientes (no bloquean nada):

1. **Smoke manual opcional** de los flujos en `localhost:5173` cuando se quiera validar UX de los features cerrados (los 7 e2e ya cubren el flujo principal; el smoke es redundante salvo para probar interacciones no cubiertas como dark mode toggle o Responsive behavior en mobile). Sin fecha límite.

## 13. Notas recientes

- **(2026-10-19) Cierre de Fase 8 (Pulido + E2E + docs).** Feature `phase-8-polish-e2e-docs` cerrado: 6 e2e nuevos agregados a `web/e2e/buys-and-solds-flow.spec.ts` (13 totales vs 7 previos) + `README.md` reescrito para reflejar el estado real del proyecto (no más "migración en curso") + §7 marca la Fase 8 como ✅. El proyecto queda en estado "MVP manual cerrado y operativo". Verificación al cierre del feature: 113 server + 70 web + 13 e2e verdes.
- **(2026-10-19) Cierre de features `buys-and-solds` + `dashboard-iteration-1`.** T15 del feature doc formalizado: AGENTS.md §12 deja de apuntar a "arrancar WU1 backend" (WU1-WU4 ya commiteados) y pasa a apuntar al push pendiente + cleanup opcional. El estado del proyecto es: features cerradas, tests verdes, working tree limpio.
- **(2026-10-16) `openDb` crea el directorio padre de la BD** si no existe (`mkdirSync({ recursive: true })`). Antes crasheaba con `TypeError: Cannot open database because the directory does not exist` cuando `SALEMANTEINER_DIR` apuntaba a un directorio nuevo. Cubierto por 3 tests en `server/src/db/index.test.ts` (cubren `:memory:` + file-based + creación recursiva del dir). El feature doc de Fase 2 ahora usa `$env:TEMP\salemanteiner-smoke` como ejemplo portable.
- **(2026-10-19) Persistencia BD en `~/.salemanteiner/` por defecto.** El server usa `~/.salemanteiner/data.db` via `os.homedir()` (configurable con `SALEMANTEINER_DIR` / `SALEMANTEINER_DB`). La "decisión pendiente" que figuraba en §12 quedó cerrada por código: `server/src/config.ts` ya implementa este path default. `openDb` crea el directorio padre si no existe.
- **(2026-10-19) Schemas Zod sin duplicación server/web en el feature `buys-and-solds`.** Ambos lados usan **euros decimales** (`EuroMoney = z.number().nonnegative().multipleOf(0.01)`). El form ya no convierte a céntimos — esa nota era del modelo legacy `sales`. La duplicación del schema (mismo Zod en server y web) sigue siendo deliberada: defensa en profundidad + evitar un monorepo `shared/` que complique el build. Si surge la voluntad de unificar, el refactor es bounded (los schemas están en `server/src/schemas/` y `web/src/schemas/` y son archivos chicos).
- **(2026-10-19) Tests Vitest del frontend web.** 70 tests en 11 archivos (no los 99 que figuran en notas previas — se ajustaron al modelo `buys/solds`). Cubren schemas/formatters/api-client/api-wrapper/hooks-de-mutación/Button+Badge/SalesTable/KpiCards. La "Fase 8 (Pulido + E2E + docs)" sigue pendiente: añadir más E2E con Playwright o Vitest Browser cuando haya cambios UX nuevos. Hoy los 7 e2e cubren el flujo principal.
- **(2026-10-16) Pivote del MVP**: el plan original tenía scraping + CSV + manual; el usuario simplificó el MVP a manual únicamente. El scraping queda como evolución futura (Fase 4, retirada).
