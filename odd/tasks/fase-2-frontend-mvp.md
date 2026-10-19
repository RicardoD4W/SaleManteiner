# Fase 2 — Frontend MVP (manual sales tracker)

> Feature document. Frontend para la app SaleManteiner, sobre el backend de Fase 1.

## Stack

- **React 19** + TypeScript + Vite 8 (ya)
- **Tailwind 4** con brand colors (ya)
- **React Router v7** (nuevo) — multi-página
- **TanStack Query v5** (nuevo) — data fetching + cache + invalidación
- **TanStack Table v8** (plan original) — tabla headless
- **React Hook Form + @hookform/resolvers** (plan original) — forms
- **Zod** (ya) — validación compartida (duplicada en `web/src/schemas/` por ahora, refactor a `shared/` como deuda)

## Vistas

| Ruta         | Página          | Componentes                                                 |
| ------------ | --------------- | ----------------------------------------------------------- |
| `/`          | `SalesListPage` | `<KpiCards>`, `<SalesTable>`, botón "Nueva venta"           |
| `/sales/new` | `SaleNewPage`   | `<SaleForm mode="create">`                                  |
| `/sales/:id` | `SaleEditPage`  | `<SaleForm mode="edit" saleId={id}>` + `<DeleteSaleButton>` |

## API client

`web/src/api/sales.ts` — funciones tipadas que llaman a `/api/sales/*`. Cada una devuelve el `data` del envelope o tira error estructurado.

## Hooks (TanStack Query)

| Hook                | Query / Mutation     | Invalida                                  |
| ------------------- | -------------------- | ----------------------------------------- |
| `useStats()`        | `['stats']`          | —                                         |
| `useSales(filters)` | `['sales', filters]` | —                                         |
| `useSale(id)`       | `['sales', id]`      | —                                         |
| `useCreateSale()`   | mutation POST        | `['sales']`, `['stats']`                  |
| `useUpdateSale()`   | mutation PATCH       | `['sales']`, `['stats']`, `['sales', id]` |
| `useDeleteSale()`   | mutation DELETE      | `['sales']`, `['stats']`                  |

## Form pattern (composition-patterns)

`SaleForm` actúa como `FormProvider` (React Hook Form + Zod resolver). Los sub-componentes (`SaleFormFields`, botones) consumen el contexto. La página decide el modo (create vs edit) y pasa el contexto. Esto evita la proliferación de boolean props que advierte la skill `architecture-avoid-boolean-props`.

## Tabla (TanStack Table)

Columnas: producto, comprador, coste, precio, costes asociados, vendido, acciones (editar/eliminar). Paginación client-side por ahora (50 ventas/mes, no se justifica server-side). Sorting por columna. Sin filtros en MVP (se pueden añadir después).

## KPI cards (KpiCards)

7 stats del endpoint `/api/sales/stats`: total, vendidos, no vendidos, revenue, coste, costes asociados, **beneficio neto** (el highlight).

## Formato

- **Currency**: céntimos → `"12,50 €"` (es-ES, EUR). Helper `formatCents(n)`.
- **Date**: ISO 8601 → `"16/10/2026"` (dd/MM/yyyy). Helper `formatDate(iso)`.
- **Boolean**: `"Sí"` / `"No"` o badge con color.

## Loading / error states

- `useQuery` con `isLoading` → spinner o skeleton.
- `useQuery` con `isError` → mensaje de error con retry.
- `useMutation` con `isPending` → botón deshabilitado + spinner en botón.

## Tareas

1. Setup tracking + instalar deps (TanStack Query, Table, Router, RHF, resolvers).
2. Schemas Zod duplicados en `web/src/schemas/`.
3. API client (`api/client.ts`, `api/sales.ts`).
4. QueryClient + Router setup (`main.tsx`, `App.tsx`).
5. Componentes UI base (Button, Input, Textarea, Card, Badge, Spinner).
6. Layout (header + nav).
7. KpiCards.
8. SalesTable (TanStack Table).
9. SaleForm (RHF + Zod).
10. DeleteSaleButton.
11. Páginas (SalesListPage, SaleNewPage, SaleEditPage).
12. Formatters (lib/format.ts).
13. Verificación: typecheck, lint, build, smoke test end-to-end.

## Verificación

```powershell
# terminal 1: backend
cd "G:\Data\vscode\react\Wallapop\SaleManteiner"

# `openDb` crea el directorio padre si no existe, así que cualquier path
# válido sirve. Usa $env:TEMP para que se borre fácil.
$env:SALEMANTEINER_DIR = Join-Path $env:TEMP 'salemanteiner-smoke'
node server/dist/index.js

# terminal 2: frontend dev
npm run dev
# → http://localhost:5173
```

Pruebas manuales:

1. Cargar ventas de ejemplo vía curl (3-4 ventas, una vendida, una con coste alto, etc.)
2. Navegar a `/` y ver la tabla + KPIs.
3. Click "Nueva venta", llenar, guardar → vuelve a la lista, aparece.
4. Click en una fila → editar, guardar → vuelve a la lista, muestra cambios.
5. Click eliminar → confirma → la fila desaparece, KPIs se actualizan.

## Deuda técnica

- Schemas duplicados server/web → futuro: extraer a `shared/schemas/`.
- Sin tests de frontend (no se pidió en MVP). Para Fase 8 (E2E) se puede añadir Playwright/Vitest Browser.
- Sin dark mode toggle (la config de Tailwind 4 lo soporta, pero la UI asume claro).
- Sin i18n (la UI está hardcoded en español, como dice el plan).
- Sin paginación server-side (con ~50 ventas/mes no se necesita).
