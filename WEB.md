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

| Ruta                 | Vista               | Qué hace                                                                      |
| -------------------- | ------------------- | ----------------------------------------------------------------------------- |
| `/`                  | `DashboardPage`     | 5 tabs anidadas: Resumen, Ingresos, Productos, Compradores, Métricas          |
| `/metrics`           | `MetricsTab`        | KPIs y métricas del dashboard (sin gráficos ni tablas)                        |
| `/buys`              | `BuysListPage`      | tabla de compras + alta + borrado                                             |
| `/buys/:id`          | `BuyEditPage`       | edición de una compra                                                         |
| `/solds`             | `SoldsListPage`     | tabla de ventas + alta + borrado                                              |
| `/solds/:id`         | `SoldEditPage`      | edición de una venta                                                          |
| `/solds/:id/receipt` | `SoldReceiptPage`   | recibo imprimible de una venta (datos del cliente, productos, total)          |
| `/customers`         | `CustomersListPage` | clientes: alta, edición y borrado                                             |
| `/gastos`            | `ExpensesListPage`  | gastos: alta, edición, borrado, filtro por categoría, total y tabla ordenable |

Las altas son **modales**, no páginas: `BuyNewModal` y `SaleNewModal` se abren desde la tabla.

Las rutas de las tabs del dashboard viven en `web/src/lib/dashboardTabs.ts` (fuente única para las tabs y para el link del header): Resumen (`/`), Ingresos (`/revenue`), Productos (`/products`), Compradores (`/buyers`) y **Métricas** (`/metrics`).

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

- **Una query por recurso**, con su hook: `useBuys`, `useSolds`, `useCustomers`, `useStatsDashboard`, `useStatsMetrics`, `useBuy`, `useSold`, `useBuysStock`, `useExpenses`, `useExpenseCategories`, `useBackups`.
- **Una mutación por operación**: `useCreateBuy`, `useUpdateBuy`, `useDeleteBuy`, `useDeleteBuyCascade`, `useCreateSold`, `useUpdateSold`, `useDeleteSold`, `useCreateCustomer`, `useUpdateCustomer`, `useDeleteCustomer`, `useCreateExpense`, `useUpdateExpense`, `useDeleteExpense`, `useCreateExpenseCategory`, `useUpdateExpenseCategory`, `useDeleteExpenseCategory`, `useCreateBackup`, `useDeleteBackup`, `useRestoreBackup`.
- Cada mutación invalida lo que dejó de ser cierto (p. ej. borrar una compra invalida `buys`, `solds` y `stats`).
- Los hooks de cascada comparten máquina de estados: `useCascadeDeleteFlow`.

### Cliente HTTP

`web/src/api/client.ts`:

- `apiFetch<T>(path, options)` → `fetch` con headers JSON; devuelve `undefined` en 204; convierte cualquier error de red en `ApiError(0, { error: 'Error de red' })`.
- `ApiError` lleva `status` y `body` (`{ error, issues? }`).
- `apiErrorMessage(err, fallback)` → mensaje en español para pintar en la UI.

Los recursos (`api/buys.ts`, `api/solds.ts`, `api/customers.ts`, `api/expenses.ts`, `api/backups.ts`) son una función por endpoint y devuelven **solo el `data`** del sobre `{ data }`.

Las **métricas** no tienen módulo propio: viven en `api/solds.ts` (`soldsApi.metricsStats()` → `GET /api/stats/metrics`), con el tipo `MetricsStats` (KPIs, mes actual/anterior, variaciones, márgenes por producto, deudores y gastos por categoría). El web **no recalcula** cifras de negocio: las pide ya redondeadas al server.

Las **copias de seguridad** sí tienen módulo propio (`api/backups.ts`): `list`, `create`, `remove`, `restoreStored`, `restoreFromFile` y `downloadUrl`. La subida de un archivo va como **cuerpo binario** (`Content-Type: application/octet-stream` + cabecera `X-Filename` con el nombre original), no como `multipart`.

## 5. Schemas (Zod)

- `schemas/common.ts`, `schemas/buys.ts`, `schemas/solds.ts`, `schemas/customers.ts`: **mirror** de los del server (mismas reglas, defensa en profundidad). El server sigue siendo la autoridad.
- `schemas/fields.ts` + `schemas/forms.ts`: la **fuente de la verdad de los forms**: los campos y sus reglas se declaran una vez y los forms los derivan (no se redeclaran y divergen).

Los forms usan `zodResolver` y llevan **`noValidate`**: la validación nativa del navegador bloqueaba el envío y la de Zod nunca llegaba a mostrarse. Los errores se anuncian con `role="alert"`.

## 6. Componentes

### `components/ui/` — la base

| Componente                                                      | Para qué                                                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Modal` + `useFocusTrap` + `useScrollLock`                      | el único modal del repo (foco inicial, foco atrapado, `Escape`, montado en un portal a `document.body` con el scroll de fondo bloqueado)                    |
| `ConfirmDeleteModal`                                            | confirmación de borrado simple                                                                                                                              |
| `Button`, `Input`, `Textarea`, `Card`, `Spinner`, `SearchInput` | primitivas con dark mode                                                                                                                                    |
| `SortableTh`, `SortableTableHead`                               | cabeceras ordenables (clic, teclado, `aria-sort`)                                                                                                           |
| `VirtualTable`                                                  | tabla virtualizada (el listado largo no traba el scroll)                                                                                                    |
| `ErrorState`                                                    | estado de error con "reintentar"                                                                                                                            |
| `armedRow`                                                      | la fila "armada" + `TravellingCell` (dato que viaja al formulario)                                                                                          |
| `tableStyles`, `classNames`                                     | clases compartidas de tabla y utilidades de clases                                                                                                          |
| `inputStyles`                                                   | clases del input compartidas por `Input`, `CustomerAutocomplete` y `ProductNameAutocomplete`                                                                |
| `NotesPopover`                                                  | icono de notas + popover con la nota entera al pasar el ratón (ancho automático, texto largo en varias líneas, se mantiene abierto si el ratón entra en él) |
| `DateRangeFilter`                                               | filtro por rango de fechas: presets (Este mes, Último trimestre, Este año) + rango a medida (Desde/Hasta)                                                   |

### El modal y el scroll de la página

`Modal` es el único shell de diálogo del repo (`web/src/components/ui/Modal.tsx`). Tres reglas lo hacen **no mover la página** al abrirse:

- **Portal a `document.body`**: el modal se monta fuera del contenedor de la página. Si se montara dentro, heredaría sus márgenes (`space-y-*` da `margin-bottom` a todos los hijos menos el último) y **el documento crecería 16 px** al abrirlo → aparecería la barra de scroll y el contenido se desplazaría de lado.
- **Scroll de fondo bloqueado** (`useScrollLock`): con el modal abierto, la raíz tiene `overflow: hidden`, así que la rueda del ratón no mueve la página que queda detrás. La posición del scroll se conserva y se restaura al cerrar; las aperturas anidadas se cuentan, para que cerrar el modal de encima no desbloquee el de abajo.
- **Barra de scroll reservada** (`scrollbar-gutter: stable both-edges` en `html`, `web/src/index.css`): el hueco de la barra de scroll vertical está siempre reservado, así que el ancho del contenido no depende de si la página se puede desplazar (si no, al pasar de una lista larga a una ficha corta el contenido se iría de lado). Con `both-edges` el hueco se reserva **a los dos lados**: el contenido queda centrado en la ventana en vez de pegado al borde izquierdo. El hueco se pinta con el **fondo de la raíz** (`html`), que lleva el mismo color que la app (`gray-50` / `dark:gray-950`) y `color-scheme` según el tema: si no, se vería una franja de otro color cuando la página no tiene scroll.

### El recibo de una venta

`SoldReceiptPage` (`/solds/:id/receipt`) es un **documento imprimible**: los datos del cliente (nombre, teléfono y dirección), los productos vendidos con su cantidad, el total y, si la venta tiene importe cobrado, el cobrado y el pendiente. Se entra desde el enlace **"Recibo"** de cada fila de la lista de ventas y desde el botón **"Recibo"** de la página de editar la venta.

- **Imprimir**: el botón **"Imprimir o guardar como PDF"** llama a `window.print()` → el diálogo de impresión del navegador (o del WebView2 en la app de escritorio) permite imprimir en papel o **guardar como PDF**. No hay librería de PDF: el PDF lo pone el propio diálogo.
- **En la hoja solo sale el recibo**: la cabecera de la app y el pie con la versión se ocultan al imprimir (`print:hidden`), y el documento se imprime en A4 con márgenes de 15 mm (`@page` en `index.css`).
- **El recibo no lleva datos internos**: ni las notas ni los gastos asociados (envío, comisión). Son cosas del vendedor, no del cliente.
- Los helpers (líneas, total, pendiente, fecha) están en `web/src/lib/receipt.ts`; el cliente se pide con `useCustomer`.

### `components/sales/` — el dominio

`BuyNewModal`, `SaleNewModal`, `ProductPickerModal` (multi-select con stock), `CustomerAutocomplete` (buscador con creación en línea), `CustomerFormModal`, `DeleteBuyModal`, `DeleteCascadeModal`, `DeleteDialogs`, `DeleteCustomerModal`, `DeleteCustomerDialogs`.

`ProductNameAutocomplete` es el **autocompletado del nombre del producto** en el alta y la edición de compra: un combobox (patrón ARIA `combobox` + `listbox`) que sugiere los nombres que ya tienes en tus compras, ignora mayúsculas y acentos, se recorre con `↑ ↓`, `Enter` elige y `Esc` cierra. **No rellena nada más**: solo el nombre del producto, y el resto del formulario se sigue escribiendo a mano. Si no eliges ninguna sugerencia, el texto se guarda tal cual (un producto nuevo siempre se puede escribir). No hay autocompletado de nombre en las ventas: una línea de venta apunta a una compra (`sale_items.buy_id`), así que el nombre viene del selector.

`ProductPickerModal` además **resalta la coincidencia** dentro del nombre del producto y **recorre la lista con `↑ ↓`** (`Enter` marca o desmarca el producto activo). El filtro ignora mayúsculas y acentos, como el buscador del resto de la app.

El campo **"Cobrado (€)"** de una venta **empieza vacío** y es opcional: vacío = se asume que te ha pagado el precio entero (deuda 0); con un importe, ese importe es lo que te pagó y la deuda es lo que falta. Un `0` explícito significa "no me ha pagado nada".

### `components/expenses/` — los gastos

`ExpenseFormModal` (alta y edición; crea la primera categoría en línea si no hay ninguna), `CategoryManagerModal` (crear, renombrar y borrar categorías) y `DeleteExpenseDialog`.

### `components/dashboard/`

`StatCard` (con `profitColorClass`: verde si ganaste, rojo si perdiste), `CashFlowChart` (Recharts) y `LazyCashFlowChart` (carga diferida: el chart pesa y no tiene por qué bloquear el primer render).

### La pestaña "Métricas"

`web/src/pages/dashboard/MetricsTab.tsx`, en la ruta `/metrics`. Es una pestaña más del dashboard y, por decisión explícita del usuario, contiene **solo cajitas de KPIs y listados métricos**: **sin gráficos y sin tablas de registros**. No toca los KPIs del resumen (el significado de `beneficio_total_eur` sigue siendo el mismo).

Qué muestra, de arriba abajo:

- **Este mes**: ingresos, beneficio, gastos, beneficio neto, margen % y nº de ventas.
- **Frente al mes anterior**: variación de ingresos, beneficio, gastos y beneficio neto (en %) y variación del margen **en puntos porcentuales**. Si el mes anterior no tuvo actividad no hay comparación posible: se avisa con "El mes anterior no tuvo actividad" en lugar de mostrar un 0 %.
- **Globales**: ingresos, beneficio, margen global, gastos sobre ingresos, ticket medio, beneficio medio por venta, deuda total, clientes con deuda, valor del stock pendiente, nº de ventas, beneficio neto y gastos totales.
- **Listados métricos**: márgenes por producto, clientes con deuda y reparto de gastos por categoría.

Los datos vienen de `useStatsMetrics` (`GET /api/stats/metrics`): el front no calcula cifras de negocio.

### `components/layout/`

`Layout` (nav Dashboard · Compras · Ventas · Clientes + botón "+ Nueva" + `ThemeToggle` + footer de versiones), `NavLink`, `ThemeToggle`, `AppVersion`.

`AppVersion` (el pie) lleva **junto a las versiones** el botón **"Copia de seguridad"**, que abre `BackupModal`.

### `components/layout/BackupModal.tsx` — copia de seguridad

Modal con el listado de las copias guardadas (nombre, fecha y tamaño) y sus acciones:

- **Crear copia ahora** → `POST /api/backups` (toast "Copia creada").
- **Descargar** → enlace a `GET /api/backups/:name/download` (el archivo se descarga al disco del usuario).
- **Eliminar** → `DELETE /api/backups/:name`, con **modal de confirmación** (toast "Copia eliminada").
- **Restaurar** desde una copia guardada o **desde un archivo del disco del usuario** (input de fichero `.db`, subida binaria a `POST /api/backups/restore`).

Restaurar **reescribe la base de datos del usuario**, así que exige una **confirmación explícita** en un segundo modal: dice qué archivo se va a restaurar y recuerda que antes se guardará una copia del estado actual. Tras restaurar se invalidan las queries de datos (`backups`, `stats`, `buys`, `solds`, `customers`, `expenses`, `expense-categories`) y se avisa con el resumen de lo restaurado.

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

`lib/searchQuery.ts` exporta además `normalizeText` (minúsculas + sin acentos) y `highlightMatch`, que devuelve el texto partido en fragmentos para **resaltar** la coincidencia dentro de un nombre.

**Filtro por rango de fechas** (`lib/dateRange.ts` + `components/ui/DateRangeFilter.tsx`):

- Vive en las listas de **compras** (`/buys`) y **ventas** (`/solds`), debajo de la cabecera.
- Presets: **Este mes**, **Último trimestre** (los tres meses que incluyen el actual) y **Este año**. **Todo** quita el filtro.
- Rango a medida con dos campos de fecha: **Desde** y **Hasta**. El rango es **cerrado**: los dos extremos entran.
- **El filtro va al servidor**: `GET /api/buys?from=YYYY-MM-DD&to=YYYY-MM-DD` y lo mismo en `/api/solds` (`api/queryString.ts` monta la query). La clave de la query incluye el rango (`['buys', from, to]`) y la query usa `placeholderData`, así que la lista no parpadea mientras llega la nueva.
- En compras filtra por `purchase_date` y en ventas por `sold_at`: **las filas sin fecha no aparecen** con un filtro activo (los formularios de alta ya ponen la fecha de hoy por defecto).
- Un rango inválido (desde > hasta) **no se aplica**: sale un aviso y la lista se queda con el último rango válido.
- Con el filtro activo y sin resultados, la lista vacía dice _"No hay compras en este período"_ (o _"No hay ventas en este período"_), no "todavía".

## 8. Estilos

- Tailwind 4 con config en CSS: `@import "tailwindcss"`, `@custom-variant dark` y `@theme` (paleta brand, fuentes) en `web/src/index.css`.
- `html` lleva `scrollbar-gutter: stable both-edges`: el hueco de la barra de scroll vertical está siempre reservado (a los dos lados, para que el contenido quede centrado) y el contenido no se desplaza de lado al cambiar de ruta o al abrir un modal. La raíz pinta ese hueco con el fondo de la app (`gray-50` / `gray-950` en dark) y fija `color-scheme` según el tema, para que no quede una franja de otro color ni una barra de scroll en claro sobre la app en dark.
- **Barra de scroll con el tema de la app** (`web/src/index.css`): `::-webkit-scrollbar` la deja fina (10 px), con el **track transparente** (el hueco reservado se sigue viendo como el fondo de la app) y el **pulgar redondeado** en los tonos del tema (`gray-300` en claro, `gray-700` en dark, con un tono más claro al pasar el ratón). Los tokens viven en `--scrollbar-thumb` / `--scrollbar-thumb-hover`. Para los navegadores que no soportan `::-webkit-scrollbar` (Firefox), hay un bloque `@supports not selector(::-webkit-scrollbar)` con `scrollbar-width` y `scrollbar-color`. Chromium y el WebView2 de la app de escritorio sí lo soportan.
- Dark mode clase-based (`dark`), con anti-FOUC en `index.html` y persistencia en `localStorage` (`salemanteiner-theme`).
- Tokens y reglas: [ARCHITECTURE.md §6](ARCHITECTURE.md#6-convenciones-de-ui-tailwind-4).
- Cero comentarios en el código (solo directivas funcionales de ESLint) e identificadores en inglés.

## 9. Versiones

`scripts/write-versions.mjs` (raíz del repo) genera `web/.env` con `VITE_APP_VERSION`, `VITE_FRONT_VERSION` y `VITE_BACK_VERSION`, que Vite hornea en el bundle. `AppVersion` las muestra en el footer y cae a `"dev"` cuando no están inyectadas. El script está enganchado a `dev:web` y `build:web`: nadie tiene que acordarse.
