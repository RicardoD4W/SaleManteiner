# Arquitectura — SaleManteiner

> Cómo está construido el repo: estructura, stack, modelo de datos y convenciones de código.
> Este doc es la referencia técnica; el punto de entrada del agente es [AGENTS.md](AGENTS.md).

## 1. Estructura del repo

```text
SaleManteiner/
├── AGENTS.md                 ← punto de entrada para agentes (leelo primero)
├── ARCHITECTURE.md           ← este doc
├── WEB.md                    ← detalle técnico del frontend
├── SERVER.md                 ← detalle técnico del backend
├── PRODUCT.md                ← qué es la app, decisiones de producto, roadmap
├── WORKFLOW.md               ← gates, skills, ODD
├── DESKTOP.md                ← la app de escritorio (Tauri 2)
├── odd/                      ← docs del ODD (local, gitignored: no van al repo)
├── scripts/write-versions.mjs← genera web/.env + server/version.json
├── server/                   ← backend Node + Express
├── web/                      ← frontend React + Vite
└── desktop/                  ← shell de escritorio (Tauri 2) + sidecar
```

### Dónde mirar qué

| Workspace  | Qué contiene                                                                                  | Detalle                  |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------ |
| `server/`  | Node + Express + SQLite: config, DB, migraciones, schemas Zod, repos, rutas, tests            | [SERVER.md](SERVER.md)   |
| `web/`     | React + Vite + Tailwind: rutas, datos (TanStack Query), componentes, búsqueda, estilos, tests | [WEB.md](WEB.md)         |
| `desktop/` | Shell Tauri 2 + sidecar + instalador + auto-update                                            | [DESKTOP.md](DESKTOP.md) |

Lo que **no** depende del workspace (modelo de datos, reglas del repo, convenciones, API) vive en este doc.

## 2. Stack

| Capa             | Tecnología                                               | Notas                                                                                                                          |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Frontend         | React 19 + TypeScript + Vite 8 + Tailwind 4              | Tailwind 4 usa config en CSS (`@theme` en `web/src/index.css`), no `tailwind.config.js`. Dark mode con `@custom-variant dark`. |
| Backend          | Node 22 LTS + Express 5 + TypeScript + better-sqlite3 13 | WAL + foreign keys activados en `openDb`.                                                                                      |
| Validación       | Zod 4                                                    | Schemas en el backend; el web replica las reglas (defensa en profundidad).                                                     |
| Logging          | Pino 10 + pino-http 11                                   | `server/src/logger.ts`.                                                                                                        |
| Tests            | Vitest 5 (server + web) + Playwright (e2e)               | El web usa `pool: 'vmThreads'` y `maxWorkers: 5` (`web/vitest.config.ts`).                                                     |
| Linter / Formato | ESLint 10 + Prettier                                     | Flat config (`eslint.config.js` con `FlatCompat`). `format:check` es gate.                                                     |
| Gestor Node      | fnm                                                      | `scripts/with-fnm.ps1` en la raíz.                                                                                             |
| Gestor paquetes  | npm workspaces                                           | Workspaces: `web/`, `server/`, `desktop/`.                                                                                     |

## 3. Modelo de datos

4 tablas (`server/src/db/migrations/003_buys_and_solds.sql`). Origen: feature `buys-and-solds` (`odd/tasks/feature-buys-and-solds.md`, S1).

### `buys` (compras de producto)

| Campo              | Tipo             | Notas                                                                                 |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------- |
| `id`               | INTEGER PK       | autoincrement                                                                         |
| `product_name`     | TEXT NOT NULL    | nombre del producto                                                                   |
| `purchase_cost`    | REAL             | coste TOTAL pagado en euros decimales (se prorratea por unidad al calcular beneficio) |
| `quantity`         | INTEGER NOT NULL | unidades compradas (default UX 1)                                                     |
| `associated_costs` | REAL             | gastos envío/embalaje TOTALES en euros decimales (se prorratean por unidad)           |
| `purchase_date`    | TEXT             | `YYYY-MM-DD`, día local. Default hoy. Editable por el cliente.                        |
| `created_at`       | TEXT NOT NULL    | ISO 8601, automático (set en INSERT)                                                  |

Índice: `idx_buys_purchase_date`.

### `customers` (clientes)

| Campo        | Tipo          | Notas                |
| ------------ | ------------- | -------------------- |
| `id`         | INTEGER PK    | autoincrement        |
| `name`       | TEXT NOT NULL | nombre del cliente   |
| `created_at` | TEXT NOT NULL | ISO 8601, automático |

Índice: `idx_customers_name`.

### `solds` (ventas)

| Campo              | Tipo                                                | Notas                                               |
| ------------------ | --------------------------------------------------- | --------------------------------------------------- |
| `id`               | INTEGER PK                                          | autoincrement                                       |
| `customer_id`      | INTEGER NOT NULL FK→customers.id ON DELETE RESTRICT | el cliente no se puede borrar si tiene ventas       |
| `sale_price`       | REAL                                                | precio TOTAL de la venta (no se prorratea por item) |
| `associated_costs` | REAL                                                | gastos envío/comisión TOTALES de la venta           |
| `sold_at`          | TEXT                                                | `YYYY-MM-DD`, día local. Default hoy. Nullable.     |
| `notes`            | TEXT NULL                                           | notas libres (solo en venta)                        |
| `created_at`       | TEXT NOT NULL                                       | ISO 8601, automático                                |

Índices: `idx_solds_sold_at`, `idx_solds_customer`.

### `sale_items` (items de pack en una venta)

| Campo      | Tipo                                    | Notas                                             |
| ---------- | --------------------------------------- | ------------------------------------------------- |
| `sold_id`  | INTEGER FK → solds.id ON DELETE CASCADE | la venta padre                                    |
| `buy_id`   | INTEGER FK → buys.id ON DELETE RESTRICT | el buy no se puede borrar si tiene items vendidos |
| `quantity` | INTEGER NOT NULL                        | unidades vendidas de este buy (≥ 1)               |

PK compuesta `(sold_id, buy_id)`. Una venta puede tener N items (pack multi-producto): cada item referencia una compra distinta y una cantidad vendida.

Índices: `idx_sale_items_buy` (lookup de "¿ya vendido?", el más frecuente: lo usa la modal en cada apertura), `idx_sale_items_sold` (detalle de venta).

### Vistas SQL (migración 004) — la fuente de la verdad de las cifras

| Vista          | Qué calcula                                                                              |
| -------------- | ---------------------------------------------------------------------------------------- |
| `v_item_costs` | coste de compra prorrateado por unidad: `ROUND(coste_compra / cantidad, 2) * cantidad`   |
| `v_sold_costs` | beneficio de la venta: `sale_price - associated_costs - cogs_purchase - cogs_associated` |

El dashboard **no** recalcula cifras en JS: lee estas vistas. Ojo: usan el `ROUND` de **SQLite**, no el `round2` de JS → en un empate exacto de 3 decimales (p. ej. 0,70 € entre 4 unidades) puede diferir **1 céntimo**. Es el comportamiento pineado en `server/src/__tests__/vistas-cifras.test.ts`.

## 4. La ruta de la BD (la decide el server)

`server/src/config.ts` + `server/src/db/resolve-path.ts`, en este orden:

1. `SALEMANTEINER_DB` (archivo).
2. `SALEMANTEINER_DIR` (carpeta).
3. La **ruta canónica** por plataforma: `%APPDATA%\SaleManteiner` (Windows), `~/Library/Application Support/SaleManteiner` (macOS), `$XDG_DATA_HOME/SaleManteiner` (Linux).
4. **Fallback a la legacy**: si la ruta canónica no tiene datos pero `~/.salemanteiner/data.db` sí los tiene, se usa la legacy → nadie pierde datos.

El "¿tiene datos?" lo responde un probe **readonly** (`server/src/db/probe.ts`): si la BD no existe, está vacía o no se puede leer, cuenta como "sin datos". El arranque lo dice en el log (`dbSource: canonical | legacy`).

En Windows la canónica **nunca** cae en `%LOCALAPPDATA%\SaleManteiner` (la carpeta que borra el desinstalador de NSIS); sin `APPDATA` se usa el roaming del home.

**Los overrides explícitos mandan siempre** → el e2e sigue aislado del dato real del usuario.

## 5. Reglas del repo (no negociables)

- **Importes en euros decimales** (SQLite REAL). Validación Zod: `z.number().nonnegative().multipleOf(0.01)` (`EuroMoney` en `server/src/schemas/common.ts`). Nada de céntimos.
- **`round2()`** (`server/src/lib/round.ts` y `web/src/lib/round.ts`) en toda suma/resta/multiplicación de importes: mitiga el error IEEE 754.
- **Coste de compra = TOTAL pagado**: el form pide el total; el backend guarda `purchase_cost` total + `quantity` y calcula el unitario con `round2(buy.purchase_cost / buy.quantity)` cuando hace falta.
- **Validación de stock transaccional**: `POST /api/solds` corre dentro de `db.transaction()`. Lee el stock disponible de cada `buy_id`, valida cobertura, inserta la venta y sus items. Si no cubre → rollback + **422** con `{ error: 'Stock insuficiente', items: [{ buy_id, product_name, disponibles, solicitado }] }`.
- **`created_at`** se setea en el INSERT (no se acepta del cliente).
- **`purchase_date` y `sold_at` los gestiona el cliente**: si el cliente los manda, el server pisa; si no, conserva el valor existente; `null` explícito borra.
- **Prorrateo en packs** (topProducts): `si.quantity * (s.sale_price / total_qty_de_la_venta)` → el revenue se reparte entre los items del pack, sin over-count.
- **Borrado en cascada sin undo** (decisión de producto): el server deja audit trail en el log (Pino) y la UI avisa "Esta acción no se puede deshacer".
- **Un solo origen**: en la app de escritorio el server sirve el `web/dist` con fallback de SPA. El contrato de la API no cambia (`/api/*` igual, lo que no existe sigue dando 404 JSON).

### Zod: defaults en create vs update

- **Create** (`CreateBuyInput`, `CreateSoldInput`, `CreateCustomerInput`): `.default(0)` / `.default(false)` → ausencia = "usá el default".
- **Update** (`UpdateBuyInput`, `UpdateSoldInput`, `UpdateCustomerInput`): `.optional()` (NO `.default()`) → ausencia = "no cambiar".
- **No** usar `CreateXInput.partial()` en los updates: el default de create se aplicaría también al parse del PATCH y "no enviar coste" pisaría el valor existente con 0.
- El repo, en `update()`, filtra los `undefined` antes del spread sobre el registro existente.
- `.strict()` en los inputs, `.nullable()` en los outputs, `safeParse` + `flatten` para los errores, schemas a nivel de módulo.

## 6. Convenciones de UI (Tailwind 4)

### Dark mode

Estrategia `@custom-variant dark` (clase-based) en `web/src/index.css`. Mobile-first: base = light, `dark:` para el equivalente oscuro.

- **NUNCA** un color hardcodeado sin su contraparte `dark:` (si ves `bg-gray-100` sin `dark:bg-gray-800`, agregá la contraparte).
- **NO** usar `darkMode: 'media'` (desactiva el toggle). Solo `'class'`.
- **Anti-FOUC**: el script inline de `web/index.html` aplica la clase `dark` antes del primer paint. Si agregás un entry point, mantenelo.
- **Default**: sin `localStorage` → respetar `prefers-color-scheme`; sin match → arrancar en dark.
- **Persistencia**: clave `salemanteiner-theme`, valores `"light"` | `"dark"`.

Tokens canónicos (un par por rol, no inventar variantes):

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

- **SVG / charts**: los `fill="#..."` / `stroke="#..."` hardcodeados se quedan como fallback; agregar `className="dark:fill-... dark:stroke-..."` (Tailwind lo traduce con CSS specificity que pisa el atributo). Patrón en `web/src/components/dashboard/CashFlowChart.tsx`.
- **Focus visible en dark**: el `ring-offset` va sobre el fondo oscuro del contenedor → `focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`.

Referencias: `odd/tasks/feature-dark-mode.md` (S1-S10) y la skill `web/.agents/skills/tailwind-css-patterns/SKILL.md`.

### Ordenamiento de tablas (una sola mecánica)

Las 5 tablas usan el hook `useSortable`. El comparador vive en `web/src/lib/sorting.ts` (nulos primero, números como números, textos en español con los dígitos en su lugar; la primera dirección siempre ascendente) y la cabecera en `<SortableTh>` (clic, teclado, `aria-sort`, `scope="col"`, indicador).

TanStack Table quedó solo para layout de columnas y virtualización. **Ojo con TanStack v8.21**: su `sortingFn` recibe las **filas**, no los valores (`sortingFn(rowA, rowB, columnId)`) → si se usa, hay que extraer el valor con `row.getValue(columnId)`.

### Formularios

Los forms derivan las reglas de un schema compartido (`web/src/schemas/fields.ts` + `forms.ts`) y usan `zodResolver`. Los forms llevan `noValidate`: la validación nativa del navegador bloqueaba el envío y **la validación de Zod nunca llegaba a mostrarse**. Los errores se anuncian (`role="alert"`).

## 7. API (contrato)

| Ruta                                                             | Qué hace                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/health`                                                | estado + versión del server                                         |
| `GET /api/version`                                               | `{ app, front, back }` (el front las lee del footer)                |
| `GET/POST /api/buys`, `GET/PATCH/DELETE /api/buys/:id`           | CRUD de compras + `GET /api/buys/stock`                             |
| `DELETE /api/buys/:id/cascade`                                   | borra la compra y limpia las ventas, en transacción                 |
| `GET/POST /api/solds`, `GET/PATCH/DELETE /api/solds/:id`         | CRUD de ventas (items incluidos, validación de stock transaccional) |
| `GET/POST /api/customers`, `GET/PATCH/DELETE /api/customers/:id` | CRUD de clientes (borrado en cascada si tiene ventas)               |
| `GET /api/stats/dashboard`                                       | KPIs, revenueByMonth, topProducts, topBuyers                        |

Códigos de error que el web maneja: **400** (validación), **404**, **409** (borrado con ventas asociadas → el web abre la modal de cascada), **422** (stock insuficiente), **500**.

Las rutas del server registran `buys`, `solds`, `customers`, `dashboard` y `version` en `server/src/app.ts`; el orden importa (Express 5: `:id` matchea `[^/]+`, nunca paths de 2 segmentos).
