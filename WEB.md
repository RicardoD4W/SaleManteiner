# Frontend (`web/`) — SaleManteiner

> Detalle técnico del frontend: React 19 + Vite 8 + Tailwind 4 + TanStack.
> Visión general: [ARCHITECTURE.md](ARCHITECTURE.md) · Backend: [SERVER.md](SERVER.md).

## 1. Stack del frontend

| Capa        | Librería                                            | Nota                                                      |
| ----------- | --------------------------------------------------- | --------------------------------------------------------- |
| UI          | React 19 + TypeScript                               | `StrictMode` en el root                                   |
| Bundler     | Vite 8                                              | alias `@` → `web/src`                                     |
| Estilos     | Tailwind 4 (config en CSS, `@theme` en `index.css`) | plugin `@tailwindcss/vite`                                |
| Datos       | TanStack Query 5                                    | `staleTime: Infinity`, `retry: 1`, sin refetch al enfocar |
| Tablas      | TanStack Table 8                                    | solo layout de columnas y virtualización                  |
| Gráficas    | Recharts                                            | chart de flujo de caja (lazy)                             |
| Avisos      | `sileo`                                             | toasts de confirmación                                    |
| Formularios | React Hook Form + `@hookform/resolvers`             | con `zodResolver`                                         |
| Tests       | Vitest 5 + Playwright                               | unitarios y e2e                                           |

## 2. Estructura

```text
web/
├── index.html                  ← anti-FOUC (script inline que aplica la clase `dark`)
├── vite.config.ts              ← proxy /api → API_TARGET, alias @, build a web/dist
├── vitest.config.ts            ← pool 'vmThreads' + maxWorkers 5
├── playwright.config.ts        ← e2e: server en :4100, web en :5174, BD temporal
├── public/favicon.svg          ← ícono de la app (origen de los íconos de escritorio)
├── e2e/                        ← specs de Playwright
└── src/
    ├── main.tsx                ← root + QueryClientProvider + AppToaster
    ├── App.tsx                 ← RouterProvider
    ├── index.css               ← @import "tailwindcss" + @custom-variant dark + @theme
    ├── api/                    ← cliente HTTP + un módulo por recurso
    ├── components/             ← ui/ · sales/ · dashboard/ · layout/
    ├── hooks/                  ← queries y mutaciones (uno por operación)
    ├── lib/                    ← formatters, ordenamiento, búsqueda, toasts
    ├── pages/                  ← buys/ · solds/ · customers/ · dashboard/
    ├── schemas/                ← Zod del web (mirror del server) + fields/forms
    └── test-utils/             ← fixtures + render para los tests
```

## 3. Rutas

`web/src/App.tsx` (React Router, `createBrowserRouter`):

| Ruta         | Vista               | Qué hace                                                   |
| ------------ | ------------------- | ---------------------------------------------------------- |
| `/`          | `DashboardPage`     | 4 tabs anidadas: Resumen, Ingresos, Productos, Compradores |
| `/buys`      | `BuysListPage`      | tabla de compras + alta + borrado                          |
| `/buys/:id`  | `BuyEditPage`       | edición de una compra                                      |
| `/solds`     | `SoldsListPage`     | tabla de ventas + alta + borrado                           |
| `/solds/:id` | `SoldEditPage`      | edición de una venta                                       |
| `/customers` | `CustomersListPage` | clientes: alta, edición y borrado                          |

Las altas son **modales**, no páginas: `BuyNewModal` y `SaleNewModal` se abren desde la tabla.

Las rutas de las tabs del dashboard viven en `web/src/lib/dashboardTabs.ts` (fuente única para las tabs y para el link del header).

## 4. Datos: TanStack Query

`web/src/lib/queryClient.ts`:

```ts
new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});
```

`staleTime: Infinity` → los datos no se recargan solos; la app refresca **invalidando** la query después de cada mutación (helper `invalidate`).

Convenciones:

- **Una query por recurso**, con su hook: `useBuys`, `useSolds`, `useCustomers`, `useStatsDashboard`, `useBuy`, `useSold`, `useBuysStock`.
- **Una mutación por operación**: `useCreateBuy`, `useUpdateBuy`, `useDeleteBuy`, `useDeleteBuyCascade`, `useCreateSold`, `useUpdateSold`, `useDeleteSold`, `useCreateCustomer`, `useUpdateCustomer`, `useDeleteCustomer`.
- Cada mutación invalida lo que dejó de ser cierto (p. ej. borrar una compra invalida `buys`, `solds` y `stats`).
- Los hooks de cascada comparten máquina de estados: `useCascadeDeleteFlow`.

### Cliente HTTP

`web/src/api/client.ts`:

- `apiFetch<T>(path, options)` → `fetch` con headers JSON; devuelve `undefined` en 204; convierte cualquier error de red en `ApiError(0, { error: 'Error de red' })`.
- `ApiError` lleva `status` y `body` (`{ error, issues? }`).
- `apiErrorMessage(err, fallback)` → mensaje en español para pintar en la UI.

Los recursos (`api/buys.ts`, `api/solds.ts`, `api/customers.ts`) son una función por endpoint y devuelven **solo el `data`** del sobre `{ data }`.

## 5. Schemas (Zod)

- `schemas/common.ts`, `schemas/buys.ts`, `schemas/solds.ts`, `schemas/customers.ts`: **mirror** de los del server (mismas reglas, defensa en profundidad). El server sigue siendo la autoridad.
- `schemas/fields.ts` + `schemas/forms.ts`: la **fuente de la verdad de los forms**: los campos y sus reglas se declaran una vez y los forms los derivan (no se redeclaran y divergen).

Los forms usan `zodResolver` y llevan **`noValidate`**: la validación nativa del navegador bloqueaba el envío y la de Zod nunca llegaba a mostrarse. Los errores se anuncian con `role="alert"`.

## 6. Componentes

### `components/ui/` — la base

| Componente                                                      | Para qué                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Modal` + `useFocusTrap`                                        | el único modal del repo (foco inicial, foco atrapado, `Escape`)    |
| `ConfirmDeleteModal`                                            | confirmación de borrado simple                                     |
| `Button`, `Input`, `Textarea`, `Card`, `Spinner`, `SearchInput` | primitivas con dark mode                                           |
| `SortableTh`, `SortableTableHead`                               | cabeceras ordenables (clic, teclado, `aria-sort`)                  |
| `VirtualTable`                                                  | tabla virtualizada (el listado largo no traba el scroll)           |
| `ErrorState`                                                    | estado de error con "reintentar"                                   |
| `armedRow`                                                      | la fila "armada" + `TravellingCell` (dato que viaja al formulario) |
| `tableStyles`, `classNames`                                     | clases compartidas de tabla y utilidades de clases                 |

### `components/sales/` — el dominio

`BuyNewModal`, `SaleNewModal`, `ProductPickerModal` (multi-select con stock), `CustomerAutocomplete` (buscador con creación en línea), `CustomerFormModal`, `DeleteBuyModal`, `DeleteCascadeModal`, `DeleteDialogs`, `DeleteCustomerModal`, `DeleteCustomerDialogs`.

### `components/dashboard/`

`StatCard` (con `profitColorClass`: verde si ganaste, rojo si perdiste), `CashFlowChart` (Recharts) y `LazyCashFlowChart` (carga diferida: el chart pesa y no tiene por qué bloquear el primer render).

### `components/layout/`

`Layout` (nav Dashboard · Compras · Ventas · Clientes + botón "+ Nueva" + `ThemeToggle` + footer de versiones), `NavLink`, `ThemeToggle`, `AppVersion`.

## 7. Ordenamiento y búsqueda

**Ordenamiento** (`lib/sorting.ts` + hook `useSortable`):

- Una sola regla para las 5 tablas: nulos primero, números como números, textos en español con los dígitos en su lugar.
- La primera dirección siempre es ascendente; el ciclo es asc → desc → sin orden.
- El header es `<SortableTh>`: clic, teclado, `aria-sort`, `scope="col"` e indicador.
- TanStack Table quedó solo para el layout de columnas y la virtualización. **Ojo**: su `sortingFn` recibe las **filas**, no los valores (`sortingFn(rowA, rowB, columnId)`) → hay que extraer el valor con `row.getValue(columnId)`.

**Búsqueda** (`lib/searchQuery.ts`): el campo de búsqueda **parsea la query**:

| Token          | Tipo     | Matchea                                          |
| -------------- | -------- | ------------------------------------------------ |
| `ipad`         | texto    | producto o cliente (sin acentos, sin mayúsculas) |
| `25` / `25,50` | número   | precio, coste, cantidad o disponibles            |
| `x3`           | cantidad | filas con 3 unidades                             |
| `12/03/2025`   | fecha    | fecha de compra o de venta (o ISO `2025-03-12`)  |
| `-30`          | signo    | ventas con pérdida de 30 €                       |

Los tokens se combinan con AND: varias palabras = todas las condiciones.

## 8. Estilos

- Tailwind 4 con config en CSS: `@import "tailwindcss"`, `@custom-variant dark` y `@theme` (paleta brand, fuentes) en `web/src/index.css`.
- Dark mode clase-based (`dark`), con anti-FOUC en `index.html` y persistencia en `localStorage` (`salemanteiner-theme`).
- Tokens y reglas: [ARCHITECTURE.md §6](ARCHITECTURE.md#6-convenciones-de-ui-tailwind-4).
- Cero comentarios en el código (solo directivas funcionales de ESLint) e identificadores en inglés.

## 9. Versiones

`scripts/write-versions.mjs` (raíz del repo) genera `web/.env` con `VITE_APP_VERSION`, `VITE_FRONT_VERSION` y `VITE_BACK_VERSION`, que Vite hornea en el bundle. `AppVersion` las muestra en el footer y cae a `"dev"` cuando no están inyectadas. El script está enganchado a `dev:web` y `build:web`: nadie tiene que acordarse.

## 10. Tests

**Unitarios** (Vitest, 36 archivos / 277 tests): schemas, formatters, cliente HTTP, hooks de mutación, componentes de UI, tablas, KPIs, footer de versiones.

- `vitest.config.ts`: `pool: 'vmThreads'` + `maxWorkers: 5` → el jsdom se crea **una vez por worker** (la suite pasó de 25,86 s a 8,62 s). `isolate: false` está **descartado**: filtra los `vi.mock` entre archivos.
- El warm-up del chart lazy tiene su propio `hookTimeout` de 60 s (transformar `recharts` con la caché de Vite fría tarda más que 10 s).

**E2E** (Playwright, `web/e2e/`): flujos de compras/ventas, clientes, validación de formularios, búsqueda y filtros, cabeceras ordenables, view transitions.

`playwright.config.ts` levanta **su propio backend y su propio Vite** con puertos y BD temporales:

- API en `:4100` con `SALEMANTEINER_DIR`/`SALEMANTEINER_DB` → `%TEMP%\salemanteiner-e2e` (nunca toca `~/.salemanteiner`).
- Web en `:5174` con `API_TARGET` apuntando a esa API.
- `fullyParallel: false` y `workers: 1` (la BD es un archivo compartido).

## 11. Trampas

- `web/vitest.config.ts` **no está en el typecheck** (`tsconfig.json` incluye solo `src`; `tsconfig.node.json` solo `vite.config.ts`).
- Tailwind 4 **no** pone `cursor: pointer` en los `<button>` → ponelo explícito.
- El proxy de Vite usa `API_TARGET` (por defecto `http://localhost:4000`).
- `npm --workspace X` no funciona desde dentro de un workspace → `npm --prefix ..`.
