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
├── public/favicon.png          ← ícono de la app (generado desde `desktop/icon-source.png` con `npm run icon` en `desktop/`)
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

| Ruta                 | Vista               | Qué hace                                                                                               |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                  | `DashboardPage`     | 5 tabs anidadas: Resumen, Ingresos, Productos, Compradores, Métricas                                   |
| `/metrics`           | `MetricsTab`        | KPIs y métricas del dashboard (sin gráficos ni tablas)                                                 |
| `/buys`              | `BuysListPage`      | tabla de compras (precio unidad y total del lote) + alta + borrado + columna de tags y filtro por tags |
| `/buys/:id`          | `BuyEditPage`       | edición de una compra                                                                                  |
| `/solds`             | `SoldsListPage`     | tabla de ventas + alta + borrado                                                                       |
| `/solds/:id`         | `SoldEditPage`      | edición de una venta                                                                                   |
| `/solds/:id/receipt` | `SoldReceiptPage`   | recibo imprimible de una venta (datos del cliente, productos, total)                                   |
| `/customers`         | `CustomersListPage` | clientes: alta, edición y borrado                                                                      |
| `/expenses`          | `ExpensesListPage`  | gastos: alta, edición, borrado, filtro por categoría, total y tabla ordenable                          |

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

- **Una query por recurso**, con su hook: `useBuys`, `useSolds`, `useCustomers`, `useStatsDashboard`, `useStatsMetrics`, `useBuy`, `useSold`, `useBuysStock`, `useExpenses`, `useExpenseCategories`, `useBackups`, `useTags`.
- **Una mutación por operación**: `useCreateBuy`, `useUpdateBuy`, `useDeleteBuy`, `useDeleteBuyCascade`, `useCreateSold`, `useUpdateSold`, `useDeleteSold`, `useCreateCustomer`, `useUpdateCustomer`, `useDeleteCustomer`, `useCreateExpense`, `useUpdateExpense`, `useDeleteExpense`, `useCreateExpenseCategory`, `useUpdateExpenseCategory`, `useDeleteExpenseCategory`, `useCreateBackup`, `useDeleteBackup`, `useRestoreBackup`, `useCreateTag`, `useUpdateTag`, `useDeleteTag`.
- Cada mutación invalida lo que dejó de ser cierto (p. ej. borrar una compra invalida `buys`, `solds` y `stats`).
- Los hooks de cascada comparten máquina de estados: `useCascadeDeleteFlow`.

### Cliente HTTP

`web/src/api/client.ts`:

- `apiFetch<T>(path, options)` → `fetch` con headers JSON; devuelve `undefined` en 204; convierte cualquier error de red en `ApiError(0, { error: 'Error de red' })`.
- `ApiError` lleva `status` y `body` (`{ error, issues? }`).
- `apiErrorMessage(err, fallback)` → mensaje en español para pintar en la UI.

Los recursos (`api/buys.ts`, `api/solds.ts`, `api/customers.ts`, `api/expenses.ts`, `api/backups.ts`, `api/tags.ts`) son una función por endpoint y devuelven **solo el `data`** del sobre `{ data }`.

**Los tags** (`web/src/api/tags.ts`) son un recurso **parametrizado por ámbito**: `TagScope` es `'buy' | 'sold'` y todas las funciones (`listTags`, `createTag`, `updateTag`, `deleteTag`) lo reciben como primer argumento → la URL se arma como `/api/tags/${scope}`. El ámbito viaja **en la ruta**, nunca en el cuerpo ni en la query, así que el cliente no puede escribir en el catálogo equivocado. Los tipos son `ApiTag` (id, scope, name, color, created_at) y `ApiTagWithCount` (`ApiTag` + `buy_count`, que solo existe en el listado).

Los hooks (`web/src/hooks/useTags.ts`) son también **parametrizados por ámbito**: `useTags(scope)` (query key `['tags', scope]`), `useCreateTag(scope)`, `useUpdateTag(scope)` y `useDeleteTag(scope)`. Las tres mutaciones invalidan **los tags del ámbito y las compras** (`['buys']`), porque un tag cambia lo que se ve en la tabla de compras (su color tiñe la fila y su nombre aparece en la columna). Además, cada una **avisa con un toast** (como el resto de recursos): "Tag creado" (con el nombre), "Tag actualizado" (con el nombre) y "Tag eliminado".

**Las mutaciones de compras invalidan también los tags** (`['tags']`): al crear, editar o borrar una compra cambia su `tag_id`, y con eso el `buy_count` que el catálogo muestra al lado de cada tag. Como la query de tags tiene `staleTime: Infinity`, sin esa invalidación el contador se quedaba **congelado en el valor viejo** (un tag recién asignado seguía saliendo como "sin compras").

Las **métricas** no tienen módulo propio: viven en `api/solds.ts` (`soldsApi.metricsStats()` → `GET /api/stats/metrics`), con el tipo `MetricsStats` (KPIs, mes actual/anterior, variaciones, márgenes por producto, deudores y gastos por categoría). El web **no recalcula** cifras de negocio: las pide ya redondeadas al server.

Las **copias de seguridad** sí tienen módulo propio (`api/backups.ts`): `list`, `create`, `remove`, `restoreStored`, `restoreFromFile` y `downloadUrl`. La subida de un archivo va como **cuerpo binario** (`Content-Type: application/octet-stream` + cabecera `X-Filename` con el nombre original), no como `multipart`.

## 5. Schemas (Zod)

- `schemas/common.ts`, `schemas/buys.ts`, `schemas/solds.ts`, `schemas/customers.ts`: **mirror** de los del server (mismas reglas, defensa en profundidad). El server sigue siendo la autoridad.
- `schemas/fields.ts` + `schemas/forms.ts`: la **fuente de la verdad de los forms**: los campos y sus reglas se declaran una vez y los forms los derivan (no se redeclaran y divergen).

Los forms usan `zodResolver` y llevan **`noValidate`**: la validación nativa del navegador bloqueaba el envío y la de Zod nunca llegaba a mostrarse. Los errores se anuncian con `role="alert"`.

## 6. Componentes

### `components/ui/` — la base

| Componente                                                      | Para qué                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Modal` + `useFocusTrap` + `useScrollLock`                      | el único modal del repo (foco inicial, foco atrapado, `Escape`, montado en un portal a `document.body` con el scroll de fondo bloqueado; **clic fuera no cierra**)                                                                                                                                                                                                                                                                                                                    |
| `ConfirmDeleteModal`                                            | confirmación de borrado simple                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `Button`, `Input`, `Textarea`, `Card`, `Spinner`, `SearchInput` | primitivas con dark mode                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `SortableTh`, `SortableTableHead`                               | cabeceras ordenables (clic, teclado, `aria-sort`)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `VirtualTable`                                                  | tabla virtualizada (el listado largo no traba el scroll). Acepta `getRowClassName` y `getRowStyle` (opcionales) para poder dar clase o estilo a una fila concreta, y lee el **alineado de la columna** de `columnDef.meta.align` (`'center'` para las columnas de solo iconos: Tags, Notas y acciones). El **ancho de cada columna lo decide la fila de cabeceras**: `VirtualTable` la mide y aplica esos anchos fijos a las celdas del cuerpo, así cabecera y celda coinciden (<1px) |
| `ErrorState`                                                    | estado de error con "reintentar"                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `armedRow`                                                      | la fila "armada" + `TravellingCell` (el dato que viaja en la tabla) + `TravellingField` (el dato con nombre en la ficha)                                                                                                                                                                                                                                                                                                                                                              |
| `tableStyles`, `classNames`                                     | clases compartidas de tabla y utilidades de clases                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `inputStyles`                                                   | clases del input compartidas por `Input`, `CustomerAutocomplete` y `ProductNameAutocomplete`                                                                                                                                                                                                                                                                                                                                                                                          |
| `NotesPopover`                                                  | icono de notas + popover con la nota entera al pasar el ratón (ancho automático, texto largo en varias líneas, se mantiene abierto si el ratón entra en él)                                                                                                                                                                                                                                                                                                                           |
| `TagPopover`                                                    | icono del tag + popover con el **nombre y el color** del tag al pasar el ratón (mismo patrón que `NotesPopover`: portal a `document.body` + `role="tooltip"`)                                                                                                                                                                                                                                                                                                                         |
| `icons`                                                         | iconos de acción (`PencilIcon`, `TrashIcon`, `ReceiptIcon`): las acciones de fila son **iconos**, no palabras; el nombre accesible va en el `aria-label`                                                                                                                                                                                                                                                                                                                              |
| `DateRangeFilter`                                               | filtro por rango de fechas: presets (Este mes, Último trimestre, Este año) + rango a medida (Desde/Hasta). Admite la prop `layout` con los valores `'default'` y `'stacked'`: el layout por defecto no cambia y `'stacked'` apila los presets y los campos Desde/Hasta en columna                                                                                                                                                                                                     |

### El modal y el scroll de la página

`Modal` es el único shell de diálogo del repo (`web/src/components/ui/Modal.tsx`). Tres reglas lo hacen **no mover la página** al abrirse:

- **Portal a `document.body`**: el modal se monta fuera del contenedor de la página. Si se montara dentro, heredaría sus márgenes (`space-y-*` da `margin-bottom` a todos los hijos menos el último) y **el documento crecería 16 px** al abrirlo → aparecería la barra de scroll y el contenido se desplazaría de lado.
- **Scroll de fondo bloqueado** (`useScrollLock`): con el modal abierto, la raíz tiene `overflow: hidden`, así que la rueda del ratón no mueve la página que queda detrás. La posición del scroll se conserva y se restaura al cerrar; las aperturas anidadas se cuentan, para que cerrar el modal de encima no desbloquee el de abajo.
- **Barra de scroll reservada** (`scrollbar-gutter: stable both-edges` en `html`, `web/src/index.css`): el hueco de la barra de scroll vertical está siempre reservado, así que el ancho del contenido no depende de si la página se puede desplazar (si no, al pasar de una lista larga a una ficha corta el contenido se iría de lado). Con `both-edges` el hueco se reserva **a los dos lados**: el contenido queda centrado en la ventana en vez de pegado al borde izquierdo. El hueco se pinta con el **fondo de la raíz** (`html`), que lleva el mismo color que la app (`gray-50` / `dark:gray-950`) y `color-scheme` según el tema: si no, se vería una franja de otro color cuando la página no tiene scroll.

### Cómo se cierra el modal

`Modal` se cierra con el botón **"Cerrar"** (la aspa de la cabecera) o con la tecla `Escape`. **Hacer clic fuera del diálogo no lo cierra**: el clic en el fondo no descarta lo que se ha escrito, por decisión explícita del usuario. El fondo (`role="presentation"`) se sigue pintando como velo, pero no tiene manejador de clic.

### El recibo de una venta

`SoldReceiptPage` (`/solds/:id/receipt`) es un **documento imprimible**: los datos del cliente (nombre, teléfono y dirección), los productos vendidos con su cantidad, el total y, si la venta tiene importe cobrado, el cobrado y el pendiente. Se entra desde el **icono de recibo** de la **última columna** de la **lista de ventas** (columna sin cabecera, como la de acciones).

- **Imprimir**: el botón **"Imprimir o guardar como PDF"** llama a `window.print()` → el diálogo de impresión del navegador (o del WebView2 en la app de escritorio) permite imprimir en papel o **guardar como PDF**. No hay librería de PDF: el PDF lo pone el propio diálogo.
- **En la hoja solo sale el recibo**: la cabecera de la app y el pie con la versión se ocultan al imprimir (`print:hidden`), y el documento se imprime en A4 con márgenes de 15 mm (`@page` en `index.css`). La cabecera de la hoja tampoco repite el nº de venta: el título del documento se vacía durante la impresión (`beforeprint`) y se restaura al terminar (`afterprint`), así que el navegador no imprime su línea de cabecera y lo único que ve el cliente es el recibo.
- **El recibo no lleva datos internos**: ni las notas ni los gastos asociados (envío, comisión). Son cosas del vendedor, no del cliente.
- Los helpers (líneas, total, pendiente, fecha) están en `web/src/lib/receipt.ts`; el cliente se pide con `useCustomer`.
- **El recibo se abre con los datos viajando**: desde la tabla, el cliente, la fecha, el total y los productos salen de su celda y aterrizan en el recibo (y vuelven a su celda al pulsar "← Volver"). Ver "El viaje de los datos" más abajo.

### El viaje de los datos (View Transitions)

Editar una venta (o abrir su recibo) no cambia la página de golpe: **el dato que estás tocando viaja** desde la tabla hasta su sitio en la ficha. Se apoya en la **View Transitions API** (`document.startViewTransition`), que el router envuelve en la navegación cuando el enlace (o `navigate`) pide `viewTransition`.

Tres piezas, en `web/src/components/ui/armedRow.tsx`:

- **`useArmedRow`**: al pasar el ratón (o el foco, o el dedo) por el enlace de una fila, **arma** esa fila: guarda su id, precarga la caché de TanStack Query (`['solds', id]`) para que la ficha se pinte con datos en el primer fotograma y expone el contexto. La vuelta a la lista la deja armada otra vez: el enlace de "Volver" lleva `state={{ armedRowId, armedTarget }}`.
- **`TravellingCell`**: la celda de la fila armada es la que lleva `view-transition-name`. Solo viaja una fila a la vez, así que el nombre es único.
- **`TravellingField`**: el mismo nombre, en la página destino (el input del formulario, el total del recibo). Si el nombre no coincide en los dos lados, el navegador no "viaja" nada: solo hace un fundido.

El nombre lo fija un **contrato** (`web/src/lib/viewTransition.ts`): `sold-<campo>-<id>` para los datos de la venta y `sold-item-<buy_id>-name-<id>` para cada producto. La fila se arma para un destino (`armedTarget: 'edit'` o `'receipt'`): el recibo no lleva gastos asociados, así que esa celda solo viaja al editar (`targets={['edit']}`).

**Entrar y salir**: el icono de recibo de la fila es un `Link` con `viewTransition` que arma la fila → al abrirlo, el cliente, la fecha, el total y los productos viajan de la tabla al recibo; el "← Volver" del recibo hace el camino inverso. El botón de atrás del navegador **no** lleva transición: React Router solo envuelve en `startViewTransition` las navegaciones que lo piden explícitamente.

En `index.css` están las clases de la animación (`.vt-cell` y `.vt-box`, respetando `prefers-reduced-motion`) y el fundido de página (`::view-transition-old(root)` / `new(root)`).

**El color va antes que el viaje**: los datos que viajan (`.box`) tienen **dos relojes**. El de viaje (`--dur-transition`, 250 ms) mueve el dato de su sitio a su sitio; el de color (`--dur-color`, 80 ms) hace el fundido entre el color de origen y el de destino. El color termina de cambiar en los primeros 80 ms, así que el dato **sale ya con el color de destino** y el resto del viaje es solo movimiento. Al volver el mecanismo es el mismo: el "viejo" es el destino y el "nuevo" es el origen, y el cambio de color ocurre en la posición de partida.

### `components/sales/` — el dominio

`BuyNewModal`, `SaleNewModal`, `ProductPickerModal` (multi-select con stock), `CustomerAutocomplete` (buscador con creación en línea), `CustomerFormModal`, `DeleteBuyModal`, `DeleteCascadeModal`, `DeleteDialogs`, `DeleteCustomerModal`, `DeleteCustomerDialogs`.

`ProductNameAutocomplete` es el **autocompletado del nombre del producto** en el alta y la edición de compra: un combobox (patrón ARIA `combobox` + `listbox`) que sugiere los nombres que ya tienes en tus compras, ignora mayúsculas y acentos, se recorre con `↑ ↓`, `Enter` elige y `Esc` cierra. **No rellena nada más**: solo el nombre del producto, y el resto del formulario se sigue escribiendo a mano. Si no eliges ninguna sugerencia, el texto se guarda tal cual (un producto nuevo siempre se puede escribir). No hay autocompletado de nombre en las ventas: una línea de venta apunta a una compra (`sale_items.buy_id`), así que el nombre viene del selector.

`ProductPickerModal` además **resalta la coincidencia** dentro del nombre del producto y **recorre la lista con `↑ ↓`** (`Enter` marca o desmarca el producto activo). El filtro ignora mayúsculas y acentos, como el buscador del resto de la app.

El campo **"Cobrado (€)"** de una venta **empieza vacío** y es opcional: vacío = se asume que te ha pagado el precio entero (deuda 0); con un importe, ese importe es lo que te pagó y la deuda es lo que falta. Un `0` explícito significa "no me ha pagado nada".

### La compra: precio por unidad

El campo de compra es el **precio por unidad** ("Precio unidad (€) *", hint "Lo que pagaste por una unidad"), no el total del lote. El total del lote **se deriva**: `total_cost = round2(purchase_cost * quantity)`, y el servidor lo devuelve ya calculado en las lecturas de compras (campo aditivo `total_cost` en `schemas/buys.ts`).

- **La tabla de `/buys`** muestra las dos cifras: la columna **"Coste (€)"** es el total del lote (`total_cost`) y la columna **"Precio unidad (€)"** es `purchase_cost`.
- **El formulario** (alta y edición) muestra el **"Total del lote"** derivado, en vivo, con `BuyLotTotal` (`components/sales/BuyLotTotal.tsx`): el usuario escribe el precio de una unidad y ve el total que sale, para poder cuadrarlo con lo que pagó. En la edición ese total es además el destino del viaje de datos de la columna "Coste (€)" (`buy-totalCost-<id>`).
- **La búsqueda numérica** matchea el precio unitario **y** el total del lote (`lib/searchQuery.ts` indexa `purchase_cost` y `total_cost`).

Las compras que ya tuvieras antes del cambio conservan el total pagado en el campo: la app **no convierte los datos** (migración `010` sin reescribir `buys`), así que hay que corregirlas a mano. Ver [CHANGELOG.md](CHANGELOG.md).

### `components/expenses/` — los gastos

`ExpenseFormModal` (alta y edición; crea la primera categoría en línea si no hay ninguna), `CategoryManagerModal` (crear, renombrar y borrar categorías) y `DeleteExpenseDialog`.

El servidor manda el total de cada categoría como `total_amount`: `web/src/api/expenses.ts` lo convierte a `total` (el nombre que usa el modelo del web) al mapear la respuesta de la API. Cualquier alta, edición o borrado de un gasto invalida también la consulta de categorías: el nº de gastos y el total de cada categoría se actualizan solos.

### `components/tags/` — los tags de compra

Un **tag** es una etiqueta con **nombre y color** que se puede poner en una compra. Cada compra lleva **como máximo un** tag y puede no llevar ninguno: el tag es opcional y, si se asigna uno nuevo, sustituye al anterior (no acumula).

Los tags viven en un **catálogo por ámbito**: el de compras (`buy`) y el de ventas (`sold`) son independientes (el mismo nombre puede existir en los dos). Todo el stack (API, hooks, filtro, modal, columna) es **el mismo código parametrizado por ámbito**, así que el catálogo de ventas no duplica ni una línea: por ahora solo la tabla de compras lo usa.

| Pieza              | Qué hace                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TagFilter`        | el filtro de la tabla: chips de multi-selección (semántica **OR**) + el chip exclusivo **"Sin tag"** + el botón **"Gestionar tags"** + **"Quitar filtro de tags"** |
| `TagManagerModal`  | el modal gestor ("Tags de compra"): crear, renombrar, recolorear y borrar tags                                                                                     |
| `DeleteTagCascade` | el **segundo** paso del borrado: la lista de las compras que tienen el tag que se va a borrar (patrón del borrado en cascada)                                      |
| `TagColorPicker`   | la paleta de 10 colores predefinidos + un **color libre** en hexadecimal (`#rrggbb`) + el selector de color del navegador                                          |
| `TagPopover`       | el icono del tag en la celda + el popover con el **nombre y el color** (`components/ui/TagPopover.tsx`)                                                            |

**El filtro**: cada chip es un tag del catálogo y se pueden marcar **varios**: la lista muestra las compras que tengan **cualquier** de los tags marcados. El chip **"Sin tag"** es **exclusivo**: cuando está activo, el servidor **ignora** los ids de tag enviados y solo devuelve las compras sin etiquetar. El filtro **lo resuelve el servidor** (`GET /api/buys?tag_ids=3,7` o `GET /api/buys?sin_tag=true`), igual que el rango de fechas.

**El modal gestor** (`TagManagerModal`, patrón de `CategoryManagerModal`) lista los tags con su **nº de compras** y deja crear, renombrar, recolorear y borrar. Borrar un tag es un flujo de **dos pasos**:

1. **Pregunta** (arriba del modal, no al final): "¿Estás seguro de que quieres borrar el tag «{nombre}»?".
2. Si el tag **tiene compras**, al confirmar se abre el **segundo aviso** (`DeleteTagCascade`), con el mismo patrón que el borrado en cascada de una compra vendida: **lista los productos que tienen ese tag** y recuerda que **se quedan sin etiqueta** ("Las compras no se borran"). Si el tag no tiene compras, la pregunta basta y el tag se borra directamente.

Borrar un tag **desasigna**, nunca borra compras. La lista de las compras afectadas sale del filtro que ya existía (`GET /api/buys?tag_ids={id}`), a través de `useBuys`.

**La segunda decisión no se apoya en el `buy_count` del catálogo** (que puede estar desfasado en caché), sino en **la lista real** de las compras con ese tag: al elegir el tag se consulta `GET /api/buys?tag_ids={id}` y, si devuelve alguna, se muestra el segundo aviso. Mientras esa consulta está en curso, el botón de confirmar sale deshabilitado con el aviso "Comprobando si el tag tiene compras…".

**El alta y la edición de compra** llevan un selector **"Tag"** (`BuyNewModal` y `BuyEditPage`, con `tag_id` en `BuyFormSchema`): es un `select` con la opción **"Sin tag"** y los tags del catálogo de compras. El `tag_id` viaja en el `POST`/`PATCH` de la compra; `null` deja la compra sin tag.

**La columna Tags** (`BuysListPage.tsx`) va **inmediatamente a la izquierda de Notas** y pinta el icono del tag (`TagIcon`, el SVG de etiqueta de `size-6` en `components/ui/icons.tsx`) teñido con el color del tag; al pasar el ratón se abre el popover con el nombre y el color. Si la compra no tiene tag, la celda queda vacía.

**El tinte de la fila**: el color del tag se aplica como **fondo diluido de la fila**, nunca como color de texto: el texto conserva el color del tema. El color viaja a la fila como variable CSS (`--tag-color`) y la clase la pone `getRowClassName`; `VirtualTable` acepta las props opcionales `getRowClassName` y `getRowStyle` para poder dar clase o estilo a cada fila.

**La barra de filtros** de `/buys` queda en **dos bloques**: a la **izquierda** el filtro de fechas **apilado** (`<DateRangeFilter layout="stacked">`, que apila los presets y los campos Desde/Hasta en columna) y a la **derecha** el filtro de tags con su botón de gestión. Los dos bloques van **alineados por abajo** (`lg:items-end`): la fila de "Gestionar tags" queda en la **misma línea** que los campos Desde/Hasta, en vez de flotar arriba junto a los presets. El bloque de tags además queda **pegado al borde derecho** de la barra (`lg:ml-auto` en `BuysListPage` y `lg:justify-end` en las dos filas internas de `TagFilter`): los chips y los botones terminan en el mismo borde que el resto de la página, en vez de flotar en el centro del bloque. En móvil el layout sigue en columna y a la izquierda. El layout por defecto de `DateRangeFilter` no cambia: `/solds` lo sigue usando tal cual.

**Las columnas de solo iconos van centradas** (Tags, Notas y acciones) en **todas** las tablas: el texto se alinea a la izquierda (producto, cliente, importe) y los iconos, al centro. En las tablas virtualizadas (`/buys`, `/solds`) el centrado se declara por columna con `meta: { align: 'center' }` y lo aplica `VirtualTable` a la cabecera y a la celda; en las tablas simples (`/customers`, `/gastos`) se marca directamente en el `th`/`td`.

**La cabecera y sus celdas comparten el mismo ancho**: el reparto de columnas de `VirtualTable` usa `flex` con `basis: 0`, así que el ancho de cada celda depende del **contenido mínimo** de esa fila, y como la cabecera (rótulos largos + indicador de orden) y el cuerpo (números, iconos) tienen contenidos distintos, **cada fila repartía el ancho de otra manera** y los rótulos caían desalineados de sus columnas. Ahora `VirtualTable` **mide la fila de cabeceras** (`useLayoutEffect` + `ResizeObserver`) y aplica esos anchos fijos a las celdas del cuerpo: el reparto se decide una sola vez y todos los rótulos quedan sobre su columna. La columna de **acciones** va con `meta: { compact: true }` (padding `px-2`) para que sus dos iconos quepan sin ensanchar la tabla.

**La paleta y la accesibilidad** (`web/src/lib/tagColors.ts`):

- `TAG_PALETTE`: los 10 colores predefinidos.
- `isValidTagColor`: valida el formato `#rrggbb` (el mismo regex que usa el server).
- El tinte está **acotado**: `--tag-tint-alpha` vale **14 %** en claro y **20 %** en oscuro (y +4 % en hover), así que el fondo resultante nunca es opaco.
- La **regla de contraste** es de **WCAG AA**: el texto de la fila sobre el fondo teñido tiene que seguir en **≥ 4.5:1** en los dos temas (`TAG_MIN_CONTRAST_RATIO`). Los helpers (`compositeOver`, `relativeLuminance`, `contrastRatio`, `tagRowContrastRatio`, `isAccessibleTagColor`) la calculan de verdad. El servidor **solo valida el formato** del color: si un color libre baja el contraste, la UI lo avisa ("Este color puede reducir el contraste de la tabla.") pero no lo bloquea.

**e2e**: `web/e2e/tags-flow.spec.ts` recorre el flujo entero (crear un tag en el modal gestor → etiquetar una compra → filtrar por tags → editar el color → borrar el tag y comprobar que las compras quedan sin etiqueta y **no** se borran) y además **mide** en el navegador que el bloque de filtro de tags termina en el borde derecho de la barra. Los fixtures (`web/e2e/fixtures.ts`) borran también los tags al limpiar la BD de la prueba.

### `components/dashboard/`

`StatCard`, `CashFlowChart` (Recharts) y `LazyCashFlowChart` (carga diferida: el chart pesa y no tiene por qué bloquear el primer render).

**La leyenda es interactiva**: el nombre de cada serie es un botón. Al hacer click, esa línea se esconde de la gráfica (y el nombre queda tachado y atenuado); al volver a hacer click, la línea aparece. Por defecto se muestran todas.

**La web recuerda la selección**: las series ocultas se guardan en `localStorage` (clave `salemanteiner-chart-<gráfica>-hidden`), así que el usuario no tiene que volver a prepararla en cada visita. La lectura y la escritura están en `web/src/lib/chartPreferences.ts` y el estado en `web/src/hooks/useChartSeriesVisibility.ts`; si el almacenamiento no está disponible (modo privado) o el valor guardado está corrupto, la gráfica se dibuja con todas las series.

**El KPI y su línea son del mismo color**: cada métrica tiene un único token (`--color-metric-*` en `web/src/index.css`) y el mapa vive en `web/src/lib/colors.ts` (`METRIC_COLOR` para el texto del KPI, `METRIC_CHART_COLOR` para la línea y `METRIC_DOT_COLOR` para el punto del tooltip). Compras en rojo, gastos en ámbar, beneficio en verde y resultado del mes en violeta: el número de la cajita y la línea que lo dibuja se leen como la misma magnitud. El verde es siempre del beneficio (los ingresos van en neutro) y el cero es neutro, no un color. Detalle de la paleta: [ARCHITECTURE.md §6](ARCHITECTURE.md#6-convenciones-de-ui-tailwind-4).

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
- **Eliminar** → `DELETE /api/backups/:name`, con **modal de confirmación** (toast "Copia eliminada"). Es un **icono de papelera** (`aria-label="Eliminar <nombre de la copia>"`).
- **Restaurar** desde una copia guardada o **desde un archivo del disco del usuario** (input de fichero `.db`, subida binaria a `POST /api/backups/restore`).

Restaurar **reescribe la base de datos del usuario**, así que exige una **confirmación explícita** en un segundo modal: dice qué archivo se va a restaurar y recuerda que antes se guardará una copia del estado actual. Tras restaurar se invalidan las queries de datos (`backups`, `stats`, `buys`, `solds`, `customers`, `expenses`, `expense-categories`) y se avisa con el resumen de lo restaurado.

## 7. Ordenamiento y búsqueda

**Ordenamiento** (`lib/sorting.ts` + hook `useSortable`):

- Una sola regla para las 5 tablas: nulos primero, números como números, textos en español con los dígitos en su lugar.
- La primera dirección siempre es ascendente; el ciclo es asc → desc → sin orden.
- El header es `<SortableTh>`: clic, teclado, `aria-sort`, `scope="col"` e indicador.
- TanStack Table quedó solo para el layout de columnas y la virtualización. **Ojo**: su `sortingFn` recibe las **filas**, no los valores (`sortingFn(rowA, rowB, columnId)`) → hay que extraer el valor con `row.getValue(columnId)`.

**Búsqueda** (`lib/searchQuery.ts`): el campo de búsqueda **parsea la query**:

| Token          | Tipo     | Matchea                                               |
| -------------- | -------- | ----------------------------------------------------- |
| `ipad`         | texto    | producto o cliente (sin acentos, sin mayúsculas)      |
| `25` / `25,50` | número   | precio unidad, coste del lote, cantidad o disponibles |
| `x3`           | cantidad | filas con 3 unidades                                  |
| `12/03/2025`   | fecha    | fecha de compra o de venta (o ISO `2025-03-12`)       |
| `-30`          | signo    | ventas con pérdida de 30 €                            |

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

**Filtro por tags** (solo en `/buys`): la barra de filtros de compras tiene dos bloques, el de fechas **apilado** a la izquierda (`layout="stacked"`) y el de tags a la derecha.

- Es **multi-selección con semántica OR**: se pueden marcar varios tags y la lista muestra las compras que tengan **cualquier** de ellos.
- El chip **"Sin tag"** es **exclusivo**: con él activo, el servidor **ignora** los ids de tag y solo devuelve las compras sin etiquetar.
- **El filtro va al servidor**: `GET /api/buys?tag_ids=3,7` (CSV de ids) y `GET /api/buys?sin_tag=true` (`api/queryString.ts` los monta con `tagFilterParams`). La clave de la query de compras incluye los tags (`['buys', from, to, tagIds, sinTag]`). Un `tag_ids` con ids que no son enteros positivos se rechaza con **400**.
- Si al guardar una compra se manda un `tag_id` que no existe o que es del catálogo de ventas, el servidor lo rechaza con **422** ("El tag no existe").

## 8. Estilos

- Tailwind 4 con config en CSS: `@import "tailwindcss"`, `@custom-variant dark` y `@theme` (paleta brand, paleta de métricas, fuentes) en `web/src/index.css`.
- `html` lleva `scrollbar-gutter: stable both-edges`: el hueco de la barra de scroll vertical está siempre reservado (a los dos lados, para que el contenido quede centrado) y el contenido no se desplaza de lado al cambiar de ruta o al abrir un modal. La raíz pinta ese hueco con el fondo de la app (`gray-50` / `gray-950` en dark) y fija `color-scheme` según el tema, para que no quede una franja de otro color ni una barra de scroll en claro sobre la app en dark.
- **Barra de scroll con el tema de la app** (`web/src/index.css`): `::-webkit-scrollbar` la deja fina (10 px), con el **track transparente** (el hueco reservado se sigue viendo como el fondo de la app) y el **pulgar redondeado** en los tonos del tema (`gray-300` en claro, `gray-700` en dark, con un tono más claro al pasar el ratón). Los tokens viven en `--scrollbar-thumb` / `--scrollbar-thumb-hover`. Para los navegadores que no soportan `::-webkit-scrollbar` (Firefox), hay un bloque `@supports not selector(::-webkit-scrollbar)` con `scrollbar-width` y `scrollbar-color`. Chromium y el WebView2 de la app de escritorio sí lo soportan.
- Dark mode clase-based (`dark`), con anti-FOUC en `index.html` y persistencia en `localStorage` (`salemanteiner-theme`).
- **El tinte de los tags** (`web/src/index.css`): el token `--tag-tint-alpha` vale **14 %** en `:root` y **20 %** en `.dark`, y la clase `.tag-row-tinted` pinta el fondo de la fila con `color-mix(in oklab, var(--tag-color) var(--tag-tint-alpha), transparent)`. En hover el tinte sube 4 puntos (`calc(var(--tag-tint-alpha) + 4%)`). El color del tag llega a la fila como variable CSS (`--tag-color`), así que **el texto nunca cambia de color**: solo el fondo.
- **Animaciones de entrada** (`web/src/index.css`): dos utilidades propias para los elementos que aparecen de golpe. `animate-pop-in` (200 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`) entra **de pequeño a grande y de abajo hacia arriba**: `opacity 0 → 1` y `transform: translateY(10px) scale(0.92) → translateY(0) scale(1)`. `animate-fade-in` (150 ms) solo atenúa el fondo. Se aplican al **panel de todos los modales** (`Modal.tsx`, que cubre los ~20 modales del repo) y al **fondo** del modal, a los **bloques inline de confirmación de borrado** (`TagManagerModal`, `DeleteTagCascade`, `CategoryManagerModal`) y a las **listas de los autocompletados** (`ProductNameAutocomplete`, `CustomerAutocomplete`, con `origin-top` para que crezca desde el input). Los **toasts no se tocan**: sileo ya tiene su propia animación. Los **popovers** de notas y tags tampoco: ya se animan con una `transition` de opacidad y transform. Con `prefers-reduced-motion: reduce` las dos utilidades se desactivan (`animation: none !important`).
- **Animaciones de salida** (`web/src/index.css`): el reverso exacto de las de entrada, con la misma duración y las mismas utilidades propias de Tailwind 4. `animate-pop-out` (`pop-out 200ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`) sale **de grande a pequeño y hacia abajo**: `opacity 1 → 0` y `transform: translateY(0) scale(1) → translateY(10px) scale(0.92)`. `animate-fade-out` (150 ms, el espejo de `animate-fade-in`) solo atenúa el fondo. El **retardo de desmontaje** lo aplica el hook `useAnimatedClose` (`web/src/hooks/useExitAnimation.ts`) en el **componente dueño de la pieza visual**: el hook marca `closing`, espera 200 ms y solo entonces ejecuta la acción que desmonta el elemento (`close`, `closeWith` para cambiar de bloque y `cancel` para abortar un cierre en curso). Se aplican al **panel y al fondo de los modales** (`Modal.tsx` recibe la prop `exiting`), a los **bloques inline de confirmación de borrado** (`TagManagerModal`, `DeleteTagCascade`, `CategoryManagerModal`) y a las **listas desplegables de los autocompletados** (`ProductNameAutocomplete`, `CustomerAutocomplete`), que además **congelan el contenido** que se estaba viendo (`useState`) para que la lista no cambie de sugerencias mientras se desvanece. Con `prefers-reduced-motion: reduce` el elemento **desaparece de inmediato**: el CSS desactiva las dos utilidades (`animation: none !important`) y el hook cierra sin retardo.
- **Animaciones de las filas de las listas** (`web/src/index.css`, `web/src/hooks/useAnimatedRows.ts`): las filas de las listas (compras, ventas, clientes, gastos, tags, categorías de gasto, pestañas del dashboard, selector de productos, copias de seguridad y listas de cascada) **entran y salen con animación** en vez de aparecer y desaparecer de golpe. El mecanismo es el hook `useAnimatedRows(items, generation?, variant?)`: compara la secuencia de ids de los datos con la del render anterior, **se queda con las filas que han desaparecido durante la duración de la animación** y las devuelve junto con las que siguen, marcadas como salientes (`rowClassName(id)`); la fila que sale **conserva su posición** y solo se desmonta cuando termina la animación. Hay dos variantes: las **filas de tabla** (`<tr>`) usan `animate-row-slide-in` / `animate-row-slide-out` (240 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`, `opacity 0 → 1` y desplazamiento de 16 px, **sin escala**), porque el zoom de una fila deformaría la rejilla de columnas mientras se anima; las **filas que no son de tabla** (chips de tags, listas de modales, pestañas del dashboard, selector de productos, copias de seguridad, cascada) usan `animate-row-in` / `animate-row-out` (200 ms, desplazamiento de 10 px y escala `0.92`): **son el mismo gesto que el de los modales**. Los _keyframes_ de las filas mueven las propiedades sueltas `translate` y `scale` en vez de `transform`, porque las tablas virtualizadas (`VirtualTable`) colocan cada fila con `transform: translateY(...)` y una animación de `transform` pisaría la posición de la fila mientras se anima. El `generation` es la firma del filtro de servidor (rango de fechas, tags, categoría): cuando cambia, **toda la lista vuelve a entrar** (las filas se remontan con la clave `rowKey(id)`). **El texto de búsqueda no forma parte del `generation`**: si lo estuviera, cada tecla re-animaría la lista entera. Cuando se borra la **última** fila de una tabla, **se desvanece antes** de que aparezca el estado vacío. Con `prefers-reduced-motion: reduce` las utilidades se desactivan y la fila que sale desaparece de inmediato.
- Tokens y reglas: [ARCHITECTURE.md §6](ARCHITECTURE.md#6-convenciones-de-ui-tailwind-4).
- Cero comentarios en el código (solo directivas funcionales de ESLint) e identificadores en inglés.

## 9. Versiones

`scripts/write-versions.mjs` (raíz del repo) genera `web/.env` con `VITE_APP_VERSION`, `VITE_FRONT_VERSION` y `VITE_BACK_VERSION`, que Vite hornea en el bundle. `AppVersion` las muestra en el footer y cae a `"dev"` cuando no están inyectadas. El script está enganchado a `dev:web` y `build:web`: nadie tiene que acordarse.
