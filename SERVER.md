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
| Tests      | Vitest 5               | 20 archivos / 350 tests, BD en `:memory:`      |

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
    ├── backup/
    │   └── backup-service.ts  ← copias (VACUUM INTO), restauración y validación
    ├── schemas/               ← common, buys, solds, customers
    ├── repo/                  ← buys-repo, solds-repo, customers-repo, metrics-repo, types
    ├── routes/                ← health, version, buys, solds, customers, dashboard, metrics, backups, _shared
    └── __tests__/             ← tests
```

## 3. Arranque

`server/src/index.ts` levanta el server; `server/src/app.ts` arma la app:

- `cors` con origen local, `express.json` con límite de 1 MB, `pinoHttp` para los logs.
- Routers: `/api/health`, `/api/version`, `/api/buys`, `/api/solds`, `/api/customers`, `/api/stats`.
- El router `/api/backups` **solo se registra si se pasa un `backupService`** (`createApp`): el server real (`index.ts`) lo crea con `createBackupService({ db, dbPath: DB_PATH })` y lo inyecta.
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

| Migración                                  | Qué hace                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `001_initial.sql`                          | modelo legacy `sales` (ya no se usa)                                                                        |
| `002_purchase_date_and_manual_sold_at.sql` | fechas en el modelo legacy                                                                                  |
| `003_buys_and_solds.sql`                   | **el modelo actual**: `buys`, `solds`, `sale_items`, `customers`                                            |
| `004_vistas_cifras.sql`                    | vistas `v_item_costs` y `v_sold_costs` (la fuente de la verdad de las cifras)                               |
| `005_indices_de_fecha.sql`                 | **elimina** los índices de fecha (`idx_buys_purchase_date`, `idx_solds_sold_at`) y `idx_customers_name`     |
| `006_gastos_y_ficha_cliente.sql`           | **aditiva**: `customers.phone/address/notes`, `solds.paid_amount`, tablas `expenses` y `expense_categories` |
| `007_notas_en_compras.sql`                 | **aditiva**: `buys.notes`                                                                                   |
| `008_deuda_pagada_por_defecto.sql`         | **datos**: las ventas con `paid_amount = 0` pasan a `sale_price` (se asumen pagadas íntegras)               |
| `009_indices_performance.sql`              | **aditiva**: recrea `idx_buys_purchase_date` e `idx_solds_sold_at`                                          |

El orden es **lexicográfico**: el prefijo `NN_` va con ceros a la izquierda (`006_`, `007_`).

### Índices y predicados sargables

Índices que hay hoy: `idx_buys_purchase_date`, `idx_solds_sold_at`, `idx_solds_customer`, `idx_sale_items_buy`, `idx_expenses_date`, `idx_expenses_category`.

**Por qué no hay índice en `customers.name`**: la búsqueda de clientes filtra con `LIKE '%texto%'` (el comodín inicial impide usar el índice) y el listado ordena con `ORDER BY c.name COLLATE NOCASE`, que necesita un índice con esa collation. Un índice BINARY sobre `name` no sirve para ninguno de los dos casos: solo añadiría coste de escritura.

**Regla**: un índice de fecha solo se usa si el predicado compara la **columna cruda**. Filtrar por mes con `strftime('%Y-%m', sold_at) = ?` envuelve la columna y el índice no sirve; el predicado equivalente es un **rango**: `sold_at >= 'YYYY-MM-01' AND sold_at < 'YYYY-MM+1-01'` (ver `lib/months.ts`, `monthBounds`). Los agregados por mes de `metrics-repo.ts` y las series mensuales de `solds-repo.ts` usan rangos.

El stock disponible se calcula con una **subconsulta correlacionada asistida por índice** (`idx_sale_items_buy`): una búsqueda por cada compra. Se midió contra la alternativa (agregar `sale_items` en bloque y unirlo con `LEFT JOIN`): la subconsulta **gana** (27,8 ms frente a 37,7 ms en el listado con volumen `large`), porque el planificador materializa el agregado y se inventa un índice automático. Se mantiene la forma original (ver el Log del documento de feature).

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
| `ExpensesListQuery`    | `{ category_id }` opcional, `.strict()`             |
| `asyncHandler`         | envuelve un handler async y pasa el error al `next` |
| `respondBadRequest`    | 400 con `{ error, issues }`                         |

## 6. Rutas

| Método + ruta                        | Qué hace                                                                       | Errores             |
| ------------------------------------ | ------------------------------------------------------------------------------ | ------------------- |
| `GET /api/health`                    | estado + versión del server                                                    | —                   |
| `GET /api/version`                   | `{ app, front, back }`                                                         | —                   |
| `GET /api/buys`                      | lista de compras con `disponibles`                                             | —                   |
| `GET /api/buys/stock`                | stock por compra                                                               | —                   |
| `GET /api/buys/:id`                  | una compra                                                                     | 404                 |
| `POST /api/buys`                     | alta                                                                           | 400                 |
| `PATCH /api/buys/:id`                | edición (los `undefined` no pisan lo que no se manda)                          | 400/404             |
| `DELETE /api/buys/:id`               | borra la compra                                                                | 409 si tiene ventas |
| `DELETE /api/buys/:id/cascade`       | borra la compra y limpia las ventas, en transacción                            | 404                 |
| `GET /api/products`                  | nombres de producto distintos (para el autocompletado)                         | —                   |
| `GET /api/solds`                     | lista de ventas con beneficio + items                                          | —                   |
| `GET /api/solds/:id`                 | una venta con sus items                                                        | 404                 |
| `POST /api/solds`                    | alta con items (valida stock)                                                  | 400/**422**         |
| `PATCH /api/solds/:id`               | edición                                                                        | 400/404             |
| `DELETE /api/solds/:id`              | borra la venta                                                                 | 404                 |
| `GET /api/customers`                 | clientes con nº de ventas, total gastado y deuda                               | —                   |
| `GET /api/customers/:id`             | un cliente                                                                     | 404                 |
| `POST /api/customers`                | alta                                                                           | 400                 |
| `PATCH /api/customers/:id`           | edición                                                                        | 400/404             |
| `DELETE /api/customers/:id`          | borra el cliente                                                               | 409 si tiene ventas |
| `GET /api/expenses`                  | lista de gastos (filtro opcional por `category_id`)                            | —                   |
| `GET /api/expenses/:id`              | un gasto                                                                       | 404                 |
| `POST /api/expenses`                 | alta (exige `category_id`)                                                     | 400                 |
| `PATCH /api/expenses/:id`            | edición                                                                        | 400/404             |
| `DELETE /api/expenses/:id`           | borra el gasto                                                                 | 404                 |
| `GET /api/expense-categories`        | categorías con nº de gastos e importe total (`expenses_count`, `total_amount`) | —                   |
| `POST /api/expense-categories`       | alta (nombre único)                                                            | 400/409             |
| `PATCH /api/expense-categories/:id`  | edición del nombre                                                             | 400/404             |
| `DELETE /api/expense-categories/:id` | borra la categoría                                                             | 409 si tiene gastos |
| `GET /api/stats/dashboard`           | KPIs, flujo de caja por mes, top productos, top compradores                    | —                   |
| `GET /api/stats/metrics`             | métricas: KPIs, mes actual/anterior, variaciones y listados                    | —                   |
| `GET /api/backups`                   | lista de copias guardadas (nombre, tamaño, fecha)                              | —                   |
| `POST /api/backups`                  | crea una copia (`VACUUM INTO`)                                                 | —                   |
| `GET /api/backups/:name/download`    | descarga una copia al disco del usuario                                        | 404                 |
| `DELETE /api/backups/:name`          | elimina una copia guardada                                                     | 400/404             |
| `POST /api/backups/:name/restore`    | restaura desde una copia guardada                                              | 400/404             |
| `POST /api/backups/restore`          | restaura desde un archivo subido (binario)                                     | 400                 |

### Códigos de error

| Código | Cuándo                                | Cuerpo                                                                                        |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| 400    | la validación de Zod falla            | `{ error, issues }` (flatten)                                                                 |
| 404    | el registro no existe                 | `{ error }`                                                                                   |
| 409    | el borrado dejaría ventas huérfanas   | `{ error, associated_sales }`                                                                 |
| 409    | borrar una categoría de gasto en uso  | `{ error }`                                                                                   |
| 422    | stock insuficiente al crear una venta | `{ error: 'Stock insuficiente', items: [{ buy_id, product_name, disponibles, solicitado }] }` |
| 500    | error no previsto                     | `{ error: 'Internal Server Error' }`                                                          |

### El importe cobrado (`paid_amount`) de una venta

Es **opcional** y su ausencia significa "se asume que la venta está **pagada íntegra**" (deuda 0):

| En la petición                      | Qué significa         | Qué se guarda | Deuda    |
| ----------------------------------- | --------------------- | ------------- | -------- |
| `paid_amount` ausente o `null`      | se asume pago íntegro | `sale_price`  | 0        |
| `paid_amount: 0`                    | no te ha pagado nada  | `0`           | precio   |
| `paid_amount: X` (`0 < X < precio`) | te ha pagado X        | `X`           | precio−X |

En las respuestas, `paid_amount` es `number | null`: `null` cuando la venta está pagada íntegra. En un `PATCH`, ausente = se conserva el valor actual y `null` = vuelve a pago íntegro. Un importe cobrado **mayor** que el precio de venta se rechaza con **400**.

Los KPIs del dashboard (`GET /api/stats/dashboard`) son: `compras_total_eur`, `ventas_total_eur`, `beneficio_total_eur` (beneficio de ventas, **no cambia de significado**), `gastos_total_eur`, `beneficio_neto_eur` (`beneficio_total_eur - gastos_total_eur`), `stock_pendiente_count`. La serie `cashFlowByMonth` incluye `gastos` por mes y los descuenta del `resultado`.

### `GET /api/products` — nombres de producto para el autocompletado

Devuelve los nombres de producto que el usuario ya tiene en sus compras, derivados de `buys.product_name` (**no hay tabla de productos ni migración**):

```json
{ "data": [{ "name": "Funda iPhone 15", "uses": 3 }] }
```

- **Agrupado sin distinguir mayúsculas**: `GROUP BY product_name COLLATE NOCASE`. "iPhone 15" y "iphone 15" son el mismo producto; el nombre devuelto es la grafía de la fila **más reciente** del grupo.
- **Ordenado por número de usos** y, a igualdad, por uso más reciente: lo que más se usa es lo que más se busca.
- El filtrado de las sugerencias se hace en el cliente (el volumen es pequeño), pero el server ya unifica la grafía.

### `GET /api/stats/metrics` — métricas del dashboard

Ruta propia (`server/src/routes/metrics.ts` + `server/src/repo/metrics-repo.ts`): el front **no** recalcula cifras de negocio, las pide ya redondeadas al server. Devuelve `{ data: … }` con:

| Bloque             | Qué contiene                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kpis`             | globales: `ingresos_total_eur`, `beneficio_total_eur`, `gastos_total_eur`, `beneficio_neto_eur`, `margen_pct`, `gastos_sobre_ingresos_pct`, `ticket_medio_eur`, `beneficio_medio_venta_eur`, `ventas_count`, `clientes_count`, `clientes_con_deuda`, `deuda_total_eur`, `stock_pendiente_count`, `stock_coste_total_eur` |
| `mes_actual`       | el mes natural en curso: `month` (`YYYY-MM`), `ingresos`, `beneficio`, `gastos`, `resultado`, `margen_pct`, `ventas`                                                                                                                                                                                                     |
| `mes_anterior`     | el mes natural anterior, con la misma forma                                                                                                                                                                                                                                                                              |
| `variaciones`      | comparativa mes actual vs. mes anterior (o `null`, ver abajo)                                                                                                                                                                                                                                                            |
| `margen_productos` | top 10 de productos por ingresos: `product_id`, `product_name`, `unidades`, `ingresos`, `beneficio`, `margen_pct`                                                                                                                                                                                                        |
| `deudores`         | top 10 de clientes con deuda: `customer_id`, `customer_name`, `ventas`, `deuda`                                                                                                                                                                                                                                          |
| `gastos_categoria` | reparto de gastos: `category_id`, `name`, `total`, `pct` (sobre el total de gastos)                                                                                                                                                                                                                                      |

**Reglas de cálculo** (las aplica el repo, no el front):

- **Margen %** = `beneficio / ingresos * 100`. El beneficio sale de las vistas SQL (`v_sold_costs`), nunca de una fórmula repetida en JS.
- **Variación** = `(mes_actual − mes_anterior) / |mes_anterior| * 100`, en porcentaje. Trae cuatro variaciones (`ingresos_pct`, `beneficio_pct`, `gastos_pct`, `resultado_pct`).
- **Sin base de comparación**: si el mes anterior no tuvo actividad (ni ventas ni gastos), `variaciones` es **`null`** (no "0 %": no hay con qué comparar). Dentro de `variaciones`, cada campo es `null` cuando su valor del mes anterior fue 0.
- **La variación del margen va en puntos porcentuales**: `margen_puntos` = `margen_pct` actual − `margen_pct` anterior (de 20 % a 25 % son **+5 puntos**, no +25 %).
- El mes se calcula por mes natural (`strftime('%Y-%m', …)`) sobre `sold_at` y `expense_date`.
- El valor del stock pendiente usa el **coste de compra prorrateado** por unidad (`(purchase_cost + associated_costs) / quantity`), coherente con `v_item_costs`.
- Todos los importes y porcentajes salen con `round2()`.

La pestaña "Métricas" del web **no cambia el significado de los KPIs del resumen**: `beneficio_total_eur` sigue siendo el mismo.

### Copias de seguridad y restauración

`server/src/backup/backup-service.ts` + `server/src/routes/backups.ts`. El servicio se crea en `server/src/index.ts` con `createBackupService({ db, dbPath: DB_PATH })` y se inyecta en `createApp`.

**Dónde viven las copias**: en `<carpeta de datos>/backups/`, la misma carpeta que aloja la base de datos (`SALEMANTEINER_DIR` o la ruta canónica por plataforma, p. ej. `%APPDATA%/SaleManteiner/backups/`).

| Tipo de copia      | Nombre                                | Cuándo se crea                              |
| ------------------ | ------------------------------------- | ------------------------------------------- |
| Copia del usuario  | `salemanteiner-AAAAMMDD-HHmmss.db`    | a petición (`POST /api/backups`)            |
| Copia de seguridad | `pre-restauracion-AAAAMMDD-HHmmss.db` | **siempre** antes de cualquier restauración |

Si el nombre ya existe se le añade un sufijo (`-1`, `-2`, …). El nombre de la copia se sanea (`^[A-Za-z0-9._-]+$`, sin `..`): un nombre inválido se rechaza con 400.

**Cómo se hace una copia**: con `VACUUM INTO` → un **único fichero SQLite consistente** (sin WAL ni journals que acompañarlo) que se puede restaurar tal cual.

**Cómo se restaura**:

1. **Validación previa** (si falla → **400** y **la BD del usuario no se toca**): el archivo se abre en solo lectura, se le pasa `integrity_check` y se comprueba que existan las tablas del esquema (`customers`, `buys`, `solds`, `sale_items`). Un archivo que no sea una BD válida, esté dañado o no contenga datos de SaleManteiner se rechaza.
2. **Copia de seguridad automática** del estado actual (`pre-restauracion-AAAAMMDD-HHmmss.db`, también con `VACUUM INTO`) → una restauración equivocada es reversible.
3. **Importación transaccional**: en una única `db.transaction()` se vacían las tablas de datos y se reinsertan las de la copia **conservando los ids** (las referencias entre ventas, compras y clientes siguen apuntando al mismo sitio). Si algo falla, `rollback`: no queda estado intermedio roto.
4. **Migraciones**: al terminar se vuelve a ejecutar `runMigrations(db)`, así una copia de una versión anterior del esquema queda al día. Las copias anteriores a la migración `008` (las que guardaban el importe cobrado en `0` porque era el valor por defecto) se restauran con las ventas **pagadas íntegras**, sin deuda. El esquema de la copia se deduce de **qué migraciones aparecen en su `_migrations`** (la `006` y la `008`), no del número más alto: si a una copia anterior se le añade después una migración nueva, la copia sigue siendo "anterior a la `008`" y no resucita la deuda.

Restaurar **reemplaza** el contenido actual de la base de datos por el de la copia (no se fusiona). El resumen devuelto (`{ customers, buys, solds, sale_items, expenses, expense_categories, safety_backup }`) dice qué se restauró y cómo se llama la copia de seguridad previa.

**Subida de un archivo**: `POST /api/backups/restore` recibe el **cuerpo binario** (`Content-Type: application/octet-stream`, límite 512 MB) y el nombre original en la cabecera **`X-Filename`**. El archivo se escribe temporalmente en la carpeta de copias, se restaura y se borra. No hace falta `multipart` (ni `multer`).

El 409 es un **contrato**: el web lo maneja para abrir la modal de cascada. El borrado en cascada deja **audit trail** en el log (Pino, nivel `warn`): qué se borró y qué ventas se tocaron.

## 7. Versionado en runtime

`server/src/version.ts` resuelve las tres versiones:

- **back**: la de su propio `package.json` (siempre cierta, también en el runtime empaquetado).
- **front**: la del manifiesto `server/version.json` (lo escribe `scripts/write-versions.mjs`).
- **app**: la de `desktop/tauri.conf.json`, forzable con `SALE_MANTEINER_APP_VERSION`.

`GET /api/version` las devuelve; el web las muestra en el footer.

## 8. Tests del server

Vitest, en `server/src/__tests__/`. Los tests de rutas levantan el server real (`createApp` + `listen`) contra una **BD temporal** (`mkdtempSync` en el `tmp` del sistema): **la base de datos del usuario no se toca nunca**.

| Fichero                   | Qué cubre                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `metrics.test.ts`         | el repo de métricas: KPIs, mes actual/anterior, variaciones (incluido el `null` sin base), márgenes, deudores y gastos por categoría            |
| `metrics-routes.test.ts`  | el contrato HTTP de `GET /api/stats/metrics`                                                                                                    |
| `backups.test.ts`         | el servicio de copias: crear, listar, eliminar, restaurar, la copia de seguridad previa y el rechazo de un archivo inválido **sin tocar la BD** |
| `backups-routes.test.ts`  | el contrato HTTP de `/api/backups`: alta, listado, descarga, borrado, restauración guardada y restauración por subida binaria                   |
| `products.test.ts`        | el repo de nombres de producto: agrupación sin mayúsculas, grafía más reciente, orden por usos y conteo                                         |
| `products-routes.test.ts` | el contrato HTTP de `GET /api/products`                                                                                                         |

## 9. Banco de medición (`npm run bench`)

`server/src/scripts/bench.ts` siembra una **BD temporal** (en el `tmp` del sistema; nunca la del usuario) con un volumen controlado y reproducible, levanta la app real (`createApp` + `listen`) y mide:

- **latencia p50/p95/p99** por endpoint, con peticiones HTTP reales;
- **nº de consultas y ms de SQL por petición**, instrumentando `db.prepare`;
- **`EXPLAIN QUERY PLAN`** de cada consulta que se ejecuta, para distinguir `SCAN` de `SEARCH`;
- **el camino de escritura**, que las lecturas no cubren: crear una venta (`POST /api/solds`) con **1, 10 y 50 ítems** y el borrado en cascada de una compra (`DELETE /api/buys/:id/cascade`), con su latencia, su nº de consultas y su SQL.

La fase de escritura usa compras aparte sembradas con existencias holgadas, así que el stock no interfiere, y se mide **después** de las lecturas: el volumen que reporta el informe (`rows`, `dbBytes`) es el sembrado, no el ya escrito.

```bash
npm run bench -- --profile medium --iterations 30 --json odd/bench/baseline-medium.json
```

| Perfil   | clientes | compras | ventas | ítems de venta | gastos | meses |
| -------- | -------- | ------- | ------ | -------------- | ------ | ----- |
| `tiny`   | 10       | 20      | 30     | ~45            | 20     | 6     |
| `small`  | 100      | 500     | 1.000  | ~2.000         | 300    | 12    |
| `medium` | 500      | 2.000   | 5.000  | ~10.000        | 1.000  | 24    |
| `large`  | 2.000    | 10.000  | 25.000 | ~50.000        | 5.000  | 24    |

Opciones: `--profile`, `--iterations`, `--warmup`, `--seed`, `--dir` (conserva la BD sembrada), `--keep`, `--json`.

La siembra usa un PRNG con semilla fija (`--seed`), así que el volumen es reproducible; las fechas se reparten hacia atrás desde el día de ejecución, de modo que el mes en curso siempre tiene datos. El script **no se empaqueta** en la app de escritorio: `tsconfig.build.json` excluye `src/scripts/**`.
