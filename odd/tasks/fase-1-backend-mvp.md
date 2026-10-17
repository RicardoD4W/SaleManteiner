# Fase 1 — Backend MVP (manual sales tracker)

> Feature document. **Pivot del plan original**: el MVP arranca sin scraping, solo carga manual de ventas. El scraping queda como evolución futura. El alcance se simplificó a un tracker de profitability para reseller en Wallapop.

## Schema final (acordado con el usuario)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | — |
| `product_name` | TEXT NOT NULL | nombre del producto (obligatorio) |
| `buyer_name` | TEXT NULL | nombre del comprador (opcional) |
| `cost_cents` | INTEGER NOT NULL DEFAULT 0 | lo que costó el producto |
| `price_cents` | INTEGER NOT NULL DEFAULT 0 | por cuánto se vendió |
| `associated_costs_cents` | INTEGER NOT NULL DEFAULT 0 | costes extra (cartón, burbuja…) |
| `sold` | INTEGER NOT NULL DEFAULT 0 (CHECK 0/1) | booleano |
| `notes` | TEXT NULL | notas libres (opcional) |
| `created_at` | TEXT NOT NULL | ISO 8601, automático al insert |
| `sold_at` | TEXT NULL | ISO 8601, manejado por el repo |

Índices: `idx_sales_sold`, `idx_sales_sold_at`.

## Endpoints REST

| Método | Path | Body / Query | Respuesta |
|---|---|---|---|
| GET | `/api/sales` | `?sold=true\|false`, `?limit=N`, `?offset=N` | `{ data: Sale[] }` |
| GET | `/api/sales/stats` | — | `{ data: { total, sold, not_sold, revenue_cents, cost_cents, associated_costs_cents, net_profit_cents } }` |
| GET | `/api/sales/:id` | — | `{ data: Sale }` o 404 |
| POST | `/api/sales` | `CreateSaleInput` | 201 + `{ data: Sale }` |
| PATCH | `/api/sales/:id` | `UpdateSaleInput` (partial) | `{ data: Sale }` o 404 |
| DELETE | `/api/sales/:id` | — | 204 o 404 |

## Reglas de comportamiento

- `UpdateSaleInput = CreateSaleInput.partial()` (todo opcional).
- `sold`: 0 → 1 → `sold_at = now()`. `sold`: 1 → 0 → `sold_at = NULL`. 0→0 o 1→1 → no se toca `sold_at`.
- Errores de validación: 400 con `{ error, issues }` (Zod issues estructurados, mensajes en español).
- Errores de "no existe": 404 con `{ error, id }`.

## Tareas

1. **Tracking & docs** — odd/tasks/feature doc, Engram mirror, agents.md actualizado.
2. **BD core** — `db/index.ts` (openDb con WAL + foreign_keys), `db/migrate.ts` (runner con tabla `_migrations`), `db/migrations/001_initial.sql`.
3. **Schemas + repo** — `schemas/sales.ts` (Zod), `repo/sales-repo.ts` (CRUD + stats).
4. **Routes + tests** — `routes/sales.ts` (endpoints), `__tests__/sales.test.ts` (Vitest con BD `:memory:`).
5. **Wire** — `app.ts` recibe `SalesRepo` por deps, `index.ts` abre BD, corre migraciones, crea repo y shutdown limpio.
6. **Verificación** — `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Verificación manual tras build

```powershell
npm --workspace server run build
node server/dist/index.js
# En otra terminal:
curl http://localhost:4000/api/health
curl -X POST http://localhost:4000/api/sales -H "Content-Type: application/json" -d '{"product_name":"iPhone 12","cost_cents":15000,"price_cents":25000,"sold":true}'
curl http://localhost:4000/api/sales
curl http://localhost:4000/api/sales/stats
```

## Deuda técnica conocida

- Sin tests de integración HTTP (no agregamos supertest todavía — manual con curl).
- Migraciones sin `down` (solo forward). Se añade si aparece el caso.
- Sin paginación cursor-based (limit/offset alcanza para ~50 ventas/mes, migración a cursor si crece).
