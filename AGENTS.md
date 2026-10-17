# SaleManteiner — Contexto para agentes

> Resumen operativo del proyecto. Reemplaza al antiguo `CONTEXT.md`/`PLAN.md`. Última actualización: 2026-10-16.

## 1. Qué es

App web **local** (React + Node) que registra y mantiene un histórico de ventas de tu cuenta de Wallapop. Pensada como un **tracker de profitability para reseller**: cargar ventas (con coste, precio, gastos, comprador, vendido sí/no) y ver si el negocio cierra números.

**Plan por fases** (3 fuentes previstas a futuro, pero el MVP arranca solo con manual):

1. **MVP (Fase 1)**: entrada **manual** únicamente, modelo de datos simplificado.
2. **Evolución futura**: scraping no oficial de `api.wallapop.com` (riesgo ToS aceptado).
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

```
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
│       ├── app.ts               ← crea la app Express, registra routers
│       ├── index.ts             ← entrypoint (listen + shutdown limpio)
│       ├── db/                  ← openDb (WAL+FK+mkdir), runMigrations, migrations/001_initial.sql
│       ├── schemas/             ← common.ts (Cents, RowId, ...) y sales.ts (Create/Update/Sale)
│       ├── repo/sales-repo.ts   ← CRUD + stats (factory, recibe db para tests)
│       ├── routes/              ← health.ts, sales.ts
│       ├── __tests__/sales.test.ts ← 23 tests con BD :memory:
│       └── .agents/skills/      ← skills cargadas en server
└── web/                         ← frontend React + Vite
    ├── eslint.config.js         ← flat config (ESLint 10)
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts           ← integra @tailwindcss/vite
    └── src/
        ├── main.tsx             ← root + QueryClientProvider
        ├── App.tsx              ← RouterProvider (createBrowserRouter)
        ├── index.css            ← @import "tailwindcss" + @theme (paleta brand, font)
        ├── vite-env.d.ts
        ├── api/                 ← client.ts (envelope + ApiError) + sales.ts (CRUD/stats + import)
        ├── components/
        │   ├── ui/              ← Button, Input, Textarea, Card, Badge, Spinner
        │   ├── sales/           ← KpiCards, SalesTable (TanStack), SaleForm (RHF+Zod), DeleteSaleButton
        │   ├── import/          ← UploadCSV (papaparse), ImportPreview (tabla verde/rojo)
        │   └── layout/          ← Layout, NavLink
        ├── hooks/               ← useStats/useSales/useSale/useCreateSale/useUpdateSale/useDeleteSale/useImportSales
        ├── lib/                 ← format.ts (formatCents, formatDate, todayLocalDate, localDateToISO), download.ts (triggerDownload), queryClient.ts
        ├── pages/               ← SalesListPage, SaleNewPage, SaleEditPage, SalesImportPage
        ├── schemas/             ← sales.ts, common.ts (duplicado del backend, refactor a shared/ es deuda)
        └── .agents/skills/      ← skills cargadas en web
```

## 5. Decisiones de producto

| #   | Decisión                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Scraping no oficial** como fuente principal (riesgo de ToS aceptado por el usuario).                                                            |
| D2  | Modelo **A+**: una sola llamada trae todo el catálogo (publicados + reservados + vendidos). Estado se asigna automático y se puede editar manual. |
| D3  | La app funciona **sin proxy** desde el día 1; cuando haya uno, se enruta con `https-proxy-agent` o `HTTPS_PROXY`.                                 |
| D4  | Mini-login email+contraseña; 2FA manual la primera vez; cookies guardadas en `~/.salemanteiner/wallapop-session.json`.                            |
| D5  | UI **solo español**, sin i18n. Fechas `dd/MM/yyyy`.                                                                                               |
| D6  | Nombre del proyecto: **SaleManteiner**.                                                                                                           |
| D7  | Volumen esperado: **~50 ventas/mes** → SQLite local basta, paginación a 25.                                                                       |
| D8  | Sincronización **manual** (sin `node-cron`). Botón "Sincronizar ahora" en la UI.                                                                  |

## 6. Modelo de datos (MVP manual)

Tabla única `sales` con modelo simplificado para carga manual. Sin scraping ni CSV en esta fase.

| Campo                    | Tipo                                   | Notas                                                                               |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `id`                     | INTEGER PK AUTOINCREMENT               | —                                                                                   |
| `product_name`           | TEXT NOT NULL                          | nombre del producto                                                                 |
| `buyer_name`             | TEXT NULL                              | nombre del comprador (opcional al inicio)                                           |
| `cost_cents`             | INTEGER NOT NULL DEFAULT 0             | lo que te costó el producto                                                         |
| `price_cents`            | INTEGER NOT NULL DEFAULT 0             | por cuánto lo vendiste                                                              |
| `associated_costs_cents` | INTEGER NOT NULL DEFAULT 0             | cartón, burbuja, envío, etc. (suma)                                                 |
| `sold`                   | INTEGER NOT NULL DEFAULT 0 (CHECK 0/1) | booleano                                                                            |
| `purchase_date`          | TEXT NULL                              | `YYYY-MM-DD`, día local. Editable por el cliente.                                   |
| `notes`                  | TEXT NULL                              | notas libres                                                                        |
| `created_at`             | TEXT NOT NULL                          | ISO 8601, automático                                                                |
| `sold_at`                | TEXT NULL                              | ISO 8601, editable por el cliente (la regla auto-set al flip de `sold` se eliminó). |

Índices: `idx_sales_sold`, `idx_sales_sold_at`. Todos los importes en **céntimos** (entero, branded `Cents`) para evitar floats.

**Reglas del repo** (no se hacen en SQL, se hacen en el repo para mantener la lógica de negocio cerca):

- `created_at` se setea en el INSERT.
- `purchase_date` y `sold_at` las gestiona el cliente. El server **respeta siempre el input**: si el cliente los manda, pisa; si no, conserva el valor existente; `null` explícito borra.
- Coherencia `sold` ↔ `sold_at` la valida Zod al parsear el input (ver S3 del feature doc en `odd/tasks/feature-purchase-date-and-manual-sold-at.md`). El form garantiza la invariante rellenando automáticamente `sold_at_date` con la fecha de hoy al flippear el checkbox "Ya lo vendí".

## 7. Fases del proyecto

| Fase                          | Estado    | Descripción                                                                                                                                                                     |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** Andamiaje               | ✅        | Monorepo `web/` + `server/`, Vite + TS, ESLint, Prettier, scripts de setup, README.                                                                                             |
| **1** Backend MVP + BD + CRUD | ✅        | SQLite + migraciones, schemas Zod de ventas (modelo simplificado manual), repo CRUD, endpoints REST, tests Vitest con BD en memoria. 23/23 tests.                               |
| **2** Frontend MVP manual     | ✅        | TanStack Query + Router + Table, RHF + Zod, KpiCards + tabla + formulario + delete. Sin tests automatizados (deuda para Fase 8). Pendiente: smoke E2E manual contra el backend. |
| 3                             | ✅        | Importación CSV (papaparse). Headers del CSV = nombres de `CreateSaleInput`. Batch atómico en server (`db.transaction` + Zod refine). UI: `/sales/import` con dropzone, preview verde/rojo, botón importar. 50/50 tests server, 99/99 tests web, 7/7 specs Playwright. |
| 4                             | pendiente | Módulo de scraping + proxy + JWT/cookies. Worker bajo demanda (sin cron).                                                                                                       |
| 5                             | pendiente | Dashboard con KPIs + gráficos (Recharts).                                                                                                                                       |
| 6                             | ✅        | Exportación CSV (mismas columnas que el import). Endpoint GET /api/sales/export con BOM UTF-8 + Content-Disposition attachment. Botón "Exportar CSV" en SalesListPage. 61/61 tests server, 99/99 tests web, 8/8 specs Playwright. |
| 7                             | pendiente | Pantalla de configuración + cifrado AES-256-GCM del token.                                                                                                                      |
| 8                             | pendiente | Pulido + tests E2E + docs.                                                                                                                                                      |

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

- Frontend → http://localhost:5173
- Backend → http://localhost:4000/api/health

Comandos útiles:

- `npm run typecheck` — TS en `web/` y `server/`
- `npm run lint` — ESLint en ambos
- `npm run format` / `format:check` — Prettier

## 9. Skills cargadas

- **server**: `zod`, `typescript-advanced-types`, `vitest` (metadata only).
- **web**: `react-best-practices`, `composition-patterns`, `typescript-advanced-types`, `vite`, `tailwind-css-patterns`, `accessibility`, `seo`, `frontend-design`.

> **Convención de trabajo**: antes de tocar código de un workspace, leer el `SKILL.md` de las skills relevantes y las `references/*.md` que apliquen al cambio. Esto NO es opcional.

Reglas Zod ya aplicadas en Fase 1: `schema-use-enums` (no aplica, no hay enums), `schema-string-validations` (ShortText/LongText), `schema-use-unknown-not-any`, `parse-use-safeparse`, `parse-validate-early`, `parse-never-trust-json`, `type-use-z-infer`, `type-export-schemas-and-types`, `type-branded-types` (Cents/RowId), `error-use-flatten`, `error-custom-messages`, `object-strict-vs-strip` (`.strict()` en inputs), `object-optional-vs-nullable` (`.optional()` en input, `.nullable()` en output), `refine-defaults` (`.default()` solo en create, NO en update — ver "Decisión: defaults en create vs update" abajo), `parse-handle-all-issues` (varios errores, no solo el primero), `perf-cache-schemas` (schemas a nivel de módulo), `type-input-vs-output` (test usa `parse()` para construir el output).

### Decisión: defaults en create vs update (importante)

**Create** (`CreateSaleInput`): campos monetarios y `sold` usan `.default(0)` / `.default(false)`. Ausencia = "usá el default" (skill `refine-defaults`).

**Update** (`UpdateSaleInput`): los mismos campos usan `.optional()` (NO `.default()`). Ausencia = "no cambiar". **No se puede usar `CreateSaleInput.partial()`** porque el default de create se aplicaría también en el parse del PATCH y "no enviar cost_cents" terminaría pisando el valor existente a 0. Por eso `UpdateSaleInput` está definido a mano con `.optional()` en cada campo.

El repo, en `update()`, filtra los `undefined` antes de hacer spread sobre el `existing` para no pisar valores que el patch no menciona.

## 10. Riesgos abiertos

| Riesgo                                | Mitigación                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Wallapop banea la cuenta por scraping | Documentado en README. Cuenta secundaria recomendada para pruebas.             |
| Wallapop cambia `api.wallapop.com`    | Worker en módulo aislado, los fallos no rompen la app. Caché + fallback a CSV. |
| Baneo de IP por rate                  | Rate limiter 1 req / 5 s + jitter + caché.                                     |
| JWT expira                            | Re-login automático; si falla, pedir credenciales.                             |
| Proxy deja de funcionar               | "Probar conexión" en ajustes; log con causa exacta.                            |
| Captcha / fingerprinting              | Documentado. Si pasa → desactivar scraping, usar manual + CSV.                 |

## 11. Fuera de alcance

Subir fotos, chat con compradores, publicar productos, multi-cuenta, push móvil, sync entre dispositivos, app móvil nativa.

## 12. Próximo paso inmediato

**Fases 1, 2, 3 y 6 cerradas** (Fase 5 sigue pendiente). El roundtrip CSV está completo: importás desde Excel/Fase 3, exportás desde la app/Fase 6. Decisiones pendientes antes de arrancar la **Fase 4 (scraping Wallapop + JWT/cookies)** o la **Fase 5 (dashboard)**:

1. Decidir si querés persistir la BD en `~/.salemanteiner/` por defecto (ahora el server usa el cwd del proceso si no se setea `SALEMANTEINER_DIR`).
2. Smoke manual **opcional** de los flujos nuevos en `localhost:5173` (import y export ya están cubiertos por E2E).

Cuando confirmes, armar el feature doc correspondiente y arrancar.

## 13. Notas recientes (2026-10-16)

- **`openDb` crea el directorio padre de la BD** si no existe (`mkdirSync({ recursive: true })`). Antes crasheaba con `TypeError: Cannot open database because the directory does not exist` cuando `SALEMANTEINER_DIR` apuntaba a un directorio nuevo. Cubierto por 3 tests en `server/src/__tests__/sales.test.ts`. El feature doc de Fase 2 ahora usa `$env:TEMP\salemanteiner-smoke` como ejemplo portable.
- **Schemas Zod duplicados** server/web (front, actual). El form trabaja en euros y convierte a céntimos antes de llamar a la API; el backend recibe céntimos. Refactor a `shared/` queda como deuda.
- **Sin tests automatizados de frontend**. SaleManteiner asume que el smoke E2E manual cubre la regresión; para Fase 8 se puede añadir Playwright/Vitest Browser.
- **Pivote del MVP**: el plan original tenía scraping + CSV + manual; el usuario simplificó el MVP a manual únicamente. El scraping queda como evolución futura (Fase 4).
