# Feature: `purchase_date` editable + `sold_at` editable por el usuario

> Tracker de profitability para reseller — fechas de compra y de venta pasan a ser datos de negocio editables, no metadata auto-gestionada por el server.

## Specs

- **S1**: agregar columna nueva `purchase_date TEXT NULL` a la tabla `sales`. Guarda **solo día local** en formato `YYYY-MM-DD` (sin hora, sin zona). Es nullable porque una venta puede existir sin fecha de compra conocida al cargarla.
- **S2**: `sold_at` deja de ser server-managed. La regla legacy _"0→1 setea `now()`; 1→0 limpia a NULL"_ se elimina. El server **siempre respeta** lo que manda el cliente en el input (nullable). Por defecto el form rellena la fecha; sin input del cliente, queda `NULL`.
- **S3**: refinamiento de validación (Zod, **server** + **web**): si `sold = true` entonces `sold_at` no puede ser `null`; si `sold = false` entonces `sold_at` debe ser `null`. Esta regla aplica en `CreateSaleInput` y `UpdateSaleInput`.
- **S4**: en el formulario (`SaleForm.tsx`), cuando el usuario marca el checkbox **"Ya lo vendí"** y el campo de fecha de venta está vacío, el form lo rellena automáticamente con la fecha de hoy (cliente). Si el campo ya tiene valor, no se pisa. El form siempre envía `sold_at` (nunca lo deja null al marcar vendido).
- **S5**: la tabla de ventas (`SalesTable.tsx`) muestra dos columnas nuevas: **Compra** (`dd/MM/yyyy` o `—`) y **Venta** (`dd/MM/yyyy` o `—`). Clickeables para ordenar (sorting TanStack con `sortingFn: 'datetime'` o equivalente).
- **S6**: tests de `sold_at` actualizados. Los tres tests existentes que verificaban la regla auto-managed (`sold 0→1 setea sold_at`, `sold 1→0 limpia sold_at`, `sold sin cambio conserva sold_at`) **cambian su contrato esperado**: ahora el server respeta lo que mande el cliente y no toca la columna por su cuenta. Se agregan tests nuevos para S1 (`purchase_date`), S2 (`sold_at` editable, incluido caso "no se manda sold_at → queda null"), S3 (validación).
- **S7**: AGENTS.md actualizado: sección **6. Modelo de datos** agrega `purchase_date`; sección con las **reglas del repo** sobre `sold_at` se reemplaza por la nueva regla (server respeta input, no auto-sync).

## Tasks

| ID  | Título                                                         | Specs      | Ruta                                                                | Commit |
| --- | -------------------------------------------------------------- | ---------- | ------------------------------------------------------------------- | ------ |
| T1  | Migración 002: schema + asset copy                             | S1         | `server/src/db/migrations/002_purchase_date_and_manual_sold_at.sql` | WU1    |
| T2  | Schemas Zod server (`LocalDate`, refinamiento S3)              | S2, S3     | `server/src/schemas/common.ts`, `server/src/schemas/sales.ts`       | WU1    |
| T3  | Repo: respetar `sold_at` y `purchase_date` del cliente         | S1, S2     | `server/src/repo/sales-repo.ts`                                     | WU1    |
| T4  | Tests server: actualizar 3 legacy + agregar cobertura S1/S2/S3 | S1, S2, S3 | `server/src/__tests__/sales.test.ts`                                | WU1    |
| T5  | Schemas Zod web (mirror servidor)                              | S2, S3     | `web/src/schemas/common.ts`, `web/src/schemas/sales.ts`             | WU2    |
| T6  | Helpers de fecha (`todayISO`, `parseISODate`)                  | S4         | `web/src/lib/format.ts`                                             | WU2    |
| T7  | Form UI: inputs date + regla "asumir hoy"                      | S4         | `web/src/components/sales/SaleForm.tsx`                             | WU2    |
| T8  | Tabla: columnas Compra / Venta                                 | S5         | `web/src/components/sales/SalesTable.tsx`                           | WU2    |
| T9  | Docs: AGENTS.md refleja nuevo modelo                           | S7         | `AGENTS.md`                                                         | WU3    |
| T10 | Smoke E2E manual + limpieza final                              | S4, S5     | (manual, anotaciones en este doc)                                   | WU3    |

**Work units (commits separados)**:

- **WU1 — backend (T1–T4)**: migración + schemas + repo + tests. Risk item 3 (cambia schema persistido) + item 6 (sin tests no se detecta regresión).
- **WU2 — frontend (T5–T8)**: mirror schemas + helpers + form + tabla. Risk: ninguno si WU1 cubre el contrato.
- **WU3 — docs + smoke (T9–T10)**: AGENTS.md + verificación manual. Cierra el feature.

## Log

- **L1** (2026-10-17, request original): _"si, necesito esos dos datos editables por el usuario"_. Pedido sobre `purchase_date` (no existía) y `sold_at` (auto-gestionado, no editable). Confirmado por el usuario tras pregunta sobre UX del checkbox: al marcar "ya lo vendí" sin tocar la fecha, **asumir hoy** (form rellena solo, mantiene compat con comportamiento legacy y suma edición explícita). Decisión técnica derivada: el server deja de auto-setear `sold_at`; respeta siempre el input del cliente.
- **L2** (2026-10-17, cierre WU1 backend): migración 002 (`ALTER TABLE sales ADD COLUMN purchase_date TEXT`). Schemas server con `LocalDate` + refinamientos separados (`soldCreateCoherenceRefine` siempre valida; `soldUpdateCoherenceRefine` solo si ambos campos vienen). Repo: `INSERT`/`UPDATE` aceptan `purchase_date` y `sold_at` del cliente; auto-sync eliminado.
- **L3** (2026-10-17, cierre WU2 frontend): mirror de schemas web. `format.ts`: `todayLocalDate`, `localDateToISO` (`YYYY-MM-DD → ISO midnight UTC`), `isoToLocalDate`, `formatDate(null) → '—'`. SaleForm: inputs `type="date"` para `purchase_date` y `sold_at_date`; regla S4 con `watch('sold')` + `setValue` para autocompletar al flip. SalesTable: columnas Compra / Venta con sort por lexicografía. Web fixtures actualizados (la clave faltante rompe el typecheck; ver `odd/...` o `web/src/test-utils/fixtures.ts`).
- **L4** (2026-10-17, cierre WU3 docs + smoke): AGENTS.md sección 6 actualizado (tabla con `purchase_date`; reglas del repo reemplazadas). Verificaciones automáticas todas verdes: `npm run typecheck` (web + server), `npm test -w server` (39/39), `npm run lint` (web + server, 0 warnings), `npm run build` (web 539kB, server con migraciones copiadas a `dist/`).
- **L5** (Smoke E2E manual — pendiente para el usuario):
  ```powershell
  # desde la raíz del repo
  fnm use 20
  npm install   # solo si hace falta
  # Arrancar backend y frontend en dos terminales:
  npm run dev   # esto levanta server :4000 y web :5173 via concurrently
  # Navegar:
  #  - http://localhost:5173 → "Nueva venta"
  #  - cargar "producto" + marcar "Ya lo vendí" → la fecha debe aparecer como hoy (editable).
  #  - guardar → KPIs actualizados, fila en la tabla con columna "Compra" vacía y "Venta" con hoy.
  #  - editar la venta → cambiar purchase_date y sold_at manualmente.
  #  - borrar / re-crear con otra fecha retrocedida para validar carga retroactiva.
  ```
  Si falla algo, anotar en este Log con L6 y abrir issue/feature doc nuevo.
