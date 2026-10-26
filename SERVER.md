# Backend (`server/`) — SaleManteiner

> Detalle técnico del backend: Express 5 + SQLite (better-sqlite3) + Zod.
> Visión general: [ARCHITECTURE.md](ARCHITECTURE.md) · Frontend: [WEB.md](WEB.md).

## 1. Stack del backend

| Capa       | Librería               | Nota                                           |
| ---------- | ---------------------- | ---------------------------------------------- |
| HTTP       | Express 5              | routers por recurso, `cors` local, `pino-http` |
| Datos      | better-sqlite3 13      | WAL, foreign keys ON, `busy_timeout` 5 s       |
| Validación | Zod 4                  | schemas por recurso + `safeParse`              |
| Logging    | Pino 10 + pino-http 11 | `server/src/logger.ts`                         |
| Tests      | Vitest 5               | 13 archivos / 238 tests, BD en `:memory:`      |

## 2. Estructura

```text
server/
├── eslint.config.js
├── scripts/copy-assets.mjs   ← copia las migraciones al dist en el build
└── src/
    ├── config.ts              ← rutas, puerto, host, log level
    ├── version.ts             ← versiones app/front/back en runtime
    ├── logger.ts              ← Pino
    ├── app.ts                 ← crea la app, registra routers, sirve el web/dist
    ├── index.ts               ← entrypoint (listen + shutdown limpio)
    ├── db/
    │   ├── index.ts           ← openDb (WAL + FK + mkdir del padre)
    │   ├── migrate.ts         ← runMigrations (tabla _migrations)
    │   ├── resolve-path.ts    ← decide la ruta de la BD
    │   ├── probe.ts           ← probe readonly: ¿esta ruta tiene datos?
    │   └── migrations/        ← 001..005
    ├── lib/
    │   ├── round.ts           ← round2()
    │   └── defined-only.ts    ← filtra undefined en los patches
    ├── schemas/               ← common, buys, solds, customers
    ├── repo/                  ← buys-repo, solds-repo, customers-repo, types
    ├── routes/                ← health, version, buys, solds, customers, dashboard, _shared
    └── __tests__/             ← tests
```

## 3. Arranque

`server/src/index.ts` levanta el server; `server/src/app.ts` arma la app:

- `cors` con origen local, `express.json` con límite de 1 MB, `pinoHttp` para los logs.
- Routers: `/api/health`, `/api/version`, `/api/buys`, `/api/solds`, `/api/customers`, `/api/stats`.
- **Static + fallback de SPA**: si existe `WEB_DIR`, sirve `web/dist` y devuelve `index.html` para cualquier ruta que no sea `/api` y no tenga extensión (esto es lo que hace que la app de escritorio tenga **un solo origen**).
- 404 JSON para lo que no existe: `{ error: 'Not Found', path }`.
- Error handler: 4xx → `warn` + `{ error: 'Invalid request' }`; cualquier otro → `error` + `{ error: 'Internal Server Error' }`.

### Variables de entorno

| Variable                     | Default                          | Para qué                                      |
| ---------------------------- | -------------------------------- | --------------------------------------------- |
| `PORT`                       | `4000`                           | puerto del server                             |
| `HOST`                       | `127.0.0.1`                      | interfaz (por defecto, solo local)            |
| `LOG_LEVEL`                  | `info`                           | nivel de Pino                                 |
| `SALEMANTEINER_DB`           | —                                | ruta exacta del archivo SQLite                |
| `SALEMANTEINER_DIR`          | —                                | carpeta de los datos                          |
| `SALEMANTEINER_WEB_DIR`      | `../web/dist` respecto al server | dónde está el web compilado                   |
| `SALE_MANTEINER_APP_VERSION` | —                                | fuerza la versión de la app en `/api/version` |

La **ruta de la BD** la decide el server (ver [ARCHITECTURE.md §4](ARCHITECTURE.md#4-la-ruta-de-la-bd-la-decide-el-server)): `SALEMANTEINER_DB` > `SALEMANTEINER_DIR` > ruta canónica por plataforma > fallback a `~/.salemanteiner/data.db` si la canónica no tiene datos. El arranque lo dice en el log (`dbSource: canonical | legacy`).

## 4. Base de datos

`openDb` (`db/index.ts`):

```ts
mkdirSync(dirname(path), { recursive: true }); // crea el directorio padre
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
```

### Migraciones

`db/migrate.ts` lee los `.sql` de `db/migrations/` (`NN_nombre.sql`), lleva la tabla `_migrations` (version, name, applied_at) y aplica **cada migración en su propia transacción**. Solo se aplican las que faltan.

| Migración                                  | Qué hace                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `001_initial.sql`                          | modelo legacy `sales` (ya no se usa)                                          |
| `002_purchase_date_and_manual_sold_at.sql` | fechas en el modelo legacy                                                    |
| `003_buys_and_solds.sql`                   | **el modelo actual**: `buys`, `solds`, `sale_items`, `customers`              |
| `004_vistas_cifras.sql`                    | vistas `v_item_costs` y `v_sold_costs` (la fuente de la verdad de las cifras) |
| `005_indices_de_fecha.sql`                 | índices de fecha para las consultas de rango                                  |

El modelo de datos completo está en [ARCHITECTURE.md §3](ARCHITECTURE.md#3-modelo-de-datos).

## 5. Capas

```
routes/  →  schemas (Zod, validan)  →  repo/ (SQL)  →  db/
```

- **`routes/`**: parsean y validan la entrada, delegan en el repo y traducen errores a códigos HTTP. Nada de SQL.
- **`schemas/`**: los schemas de Zod de cada recurso. `common.ts` define los primitivos:

  | Primitivo   | Regla                                                   |
  | ----------- | ------------------------------------------------------- |
  | `EuroMoney` | `z.number().nonnegative().multipleOf(0.01)`             |
  | `LocalDate` | `YYYY-MM-DD` **y que la fecha exista en el calendario** |
  | `ShortText` | 1..200 caracteres, no solo espacios                     |
  | `LongText`  | hasta 5000 caracteres                                   |
  | `RowId`     | entero positivo                                         |
  | `Quantity`  | entero ≥ 1                                              |

- **`repo/`**: una función por operación, con SQL parametrizado (**nunca interpolado**). `solds-repo.ts` tiene la parte delicada: `createManyWithStockCheck` corre **dentro de `db.transaction()`**, valida el stock de cada `buy_id` y hace rollback con 422 si no cubre.
- **`lib/round.ts`**: `round2()` para la aritmética de importes.

### `routes/_shared.ts`

| Helper                 | Qué hace                                            |
| ---------------------- | --------------------------------------------------- |
| `IdParam`              | `{ id }` → entero positivo (coerce)                 |
| `DateRangeQuery`       | `from` / `to` opcionales en `YYYY-MM-DD`            |
| `SalesListQuery`       | rango de fechas + `customerId`                      |
| `CustomersSearchQuery` | `{ name }` opcional, `.strict()`                    |
| `asyncHandler`         | envuelve un handler async y pasa el error al `next` |
| `respondBadRequest`    | 400 con `{ error, issues }`                         |

## 6. Rutas

| Método + ruta                  | Qué hace                                                    | Errores             |
| ------------------------------ | ----------------------------------------------------------- | ------------------- |
| `GET /api/health`              | estado + versión del server                                 | —                   |
| `GET /api/version`             | `{ app, front, back }`                                      | —                   |
| `GET /api/buys`                | lista de compras con `disponibles`                          | —                   |
| `GET /api/buys/stock`          | stock por compra                                            | —                   |
| `GET /api/buys/:id`            | una compra                                                  | 404                 |
| `POST /api/buys`               | alta                                                        | 400                 |
| `PATCH /api/buys/:id`          | edición (los `undefined` no pisan lo que no se manda)       | 400/404             |
| `DELETE /api/buys/:id`         | borra la compra                                             | 409 si tiene ventas |
| `DELETE /api/buys/:id/cascade` | borra la compra y limpia las ventas, en transacción         | 404                 |
| `GET /api/solds`               | lista de ventas con beneficio + items                       | —                   |
| `GET /api/solds/:id`           | una venta con sus items                                     | 404                 |
| `POST /api/solds`              | alta con items (valida stock)                               | 400/**422**         |
| `PATCH /api/solds/:id`         | edición                                                     | 400/404             |
| `DELETE /api/solds/:id`        | borra la venta                                              | 404                 |
| `GET /api/customers`           | clientes con nº de ventas y total gastado                   | —                   |
| `GET /api/customers/:id`       | un cliente                                                  | 404                 |
| `POST /api/customers`          | alta                                                        | 400                 |
| `PATCH /api/customers/:id`     | edición                                                     | 400/404             |
| `DELETE /api/customers/:id`    | borra el cliente                                            | 409 si tiene ventas |
| `GET /api/stats/dashboard`     | KPIs, flujo de caja por mes, top productos, top compradores | —                   |

### Códigos de error

| Código | Cuándo                                | Cuerpo                                                                                        |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| 400    | la validación de Zod falla            | `{ error, issues }` (flatten)                                                                 |
| 404    | el registro no existe                 | `{ error }`                                                                                   |
| 409    | el borrado dejaría ventas huérfanas   | `{ error, associated_sales }`                                                                 |
| 422    | stock insuficiente al crear una venta | `{ error: 'Stock insuficiente', items: [{ buy_id, product_name, disponibles, solicitado }] }` |
| 500    | error no previsto                     | `{ error: 'Internal Server Error' }`                                                          |

El 409 es un **contrato**: el web lo maneja para abrir la modal de cascada. El borrado en cascada deja **audit trail** en el log (Pino, nivel `warn`): qué se borró y qué ventas se tocaron.

## 7. Versionado en runtime

`server/src/version.ts` resuelve las tres versiones:

- **back**: la de su propio `package.json` (siempre cierta, también en el runtime empaquetado).
- **front**: la del manifiesto `server/version.json` (lo escribe `scripts/write-versions.mjs`).
- **app**: la de `desktop/tauri.conf.json`, forzable con `SALE_MANTEINER_APP_VERSION`.

`GET /api/version` las devuelve; el web las muestra en el footer.

## 8. Tests

13 archivos / 238 tests, con BD en `:memory:`:

- `buys.test.ts`, `solds.test.ts`, `customers.test.ts`, `stock.test.ts` → repos y stock.
- `buys-routes.test.ts`, `customers-routes.test.ts` → el contrato HTTP real (app Express + `fetch`): 204/400/404/409 con el cuerpo literal.
- `stats-dashboard.test.ts` → KPIs, `totals12m`, el mes y el gráfico.
- `vistas-cifras.test.ts` → las vistas SQL (incluido el caso de 1 céntimo de diferencia entre `ROUND` de SQLite y `round2` de JS).
- `db-path.test.ts` → la resolución de la ruta de la BD y el probe.
- `schemas.test.ts`, `planner.test.ts`, `version-routes.test.ts`, `web-estatico.test.ts`.

## 9. Trampas

- Express 5: `:id` matchea `[^/]+` → **nunca** matchea paths de 2 segmentos. El orden de las rutas importa (`/stock` antes de `/:id`).
- `better-sqlite3` **no cachea** el SQL preparado: prepará las statements una vez y reutilizalas.
- El `probe` de datos es **readonly**, pero puede crear los sidecars `-shm`/`-wal` (no toca `data.db`).
- `npm --workspace X` no funciona desde dentro de un workspace → `npm --prefix ..`.
- El build copia las migraciones al `dist` (`scripts/copy-assets.mjs`): sin eso, el runtime empaquetado no encuentra las migraciones.
