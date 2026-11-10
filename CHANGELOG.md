# Changelog

> Los cambios de cada versión de SaleManteiner. El formato es el de
> [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado
> es [SemVer](https://semver.org/lang/es/).
>
> La versión de la app vive en `desktop/tauri.conf.json`; la del front, en
> `web/package.json`; la del back, en `server/package.json`. El script
> `scripts/write-versions.mjs` las lee y las publica en `web/.env` y
> `server/version.json` → la app las muestra en el pie y `GET /api/version` las
> devuelve.

## [1.0.0]

**Sin publicar**

### Añadido

- **Tags en las compras**: cada compra puede llevar **un tag** (opcional) con **nombre y color**, como una categoría que te sirve para agrupar. El tag se elige al dar de alta o de editar la compra. En la tabla de `/buys` hay una columna nueva **Tags**, justo a la izquierda de Notas, con el icono de la etiqueta; al pasar el ratón por encima se ve el nombre y el color del tag.
- **El color del tag tiñe la fila**: la compra se pinta con un **tinte suave** del color del tag, solo el fondo: el texto conserva su color y se mantiene la legibilidad (el contraste del texto sobre el fondo teñido se mantiene por encima del 4,5:1, el mínimo de accesibilidad).
- **Filtro por tags en la tabla de compras**: puedes marcar **varios tags** a la vez (muestra las compras que tengan cualquiera de ellos) y hay un chip **"Sin tag"** para las compras sin etiquetar. El filtro lo resuelve el servidor, como el de fechas.
- **El gestor de tags**: desde el propio filtro se abre un modal (**"Gestionar tags"**) para **crear, renombrar, recolorear y borrar** tags. Al borrar uno te pregunta primero ("¿Estás seguro de que quieres borrar el tag «X»?") y, si el tag **tiene compras**, abre un **segundo aviso** con la **lista de los productos que lo tienen**, igual que el borrado en cascada de una compra vendida. **No se borra ninguna compra**: solo se les quita la etiqueta.
- **Los tags de ventas van aparte**: el catálogo de tags de compras y el de ventas son **independientes** (el mismo nombre puede existir en los dos). El de ventas ya está **preparado en el servidor**, pero **todavía no se muestra en la app**: es trabajo de una versión posterior.
- **Las copias de seguridad ya guardan los tags**: al crear una copia se incluyen el catálogo de tags y qué compra lleva cada uno, así que **restaurar una copia no pierde tus etiquetas**. Las copias hechas antes de esta versión se restauran igual: las compras vuelven sin tag.
- **La leyenda de la gráfica de flujo de caja es interactiva**: al hacer click en el nombre de una serie (por ejemplo, "Gastos") esa línea se esconde de la gráfica, y al volver a hacer click aparece. La web **recuerda** qué series están ocultas, así que no hay que volver a prepararla cada vez: se abre la app y la gráfica sale como la dejaste.
- **Gastos generales**: una vista nueva **Gastos** (`/expenses`, la quinta del header) con alta, edición, borrado, filtro por categoría y total de la lista. Los gastos son los que no son ni compras ni ventas (alquiler, suministros, papelería): viven en su propia tabla, no generan stock y no entran en el beneficio de ventas.
- **Categorías de gasto gestionadas por el usuario**: se crean, renombran y borran desde la propia vista. No hay catálogo sembrado → la base de datos del usuario no se toca con datos inventados. Borrar una categoría que tiene gastos pide confirmación y ofrece borrar también los gastos.
- **Borrado en cascada de una categoría de gasto**: al borrar una categoría que todavía tiene gastos, la app **no se queda bloqueada**: abre una ventana con la lista de los gastos que se van a borrar y un botón **"Borrar también los gastos y la categoría"**. Es el mismo camino que ya tenían las compras y los clientes con ventas asociadas. Como no hay vuelta atrás, la app deja rastro en el log del servidor de lo que se borró.
- **KPI "Gastos" y KPI "Beneficio neto"** en el dashboard. El KPI de beneficio **no cambia de significado**: el beneficio neto es el beneficio de ventas menos los gastos generales del periodo.
- **La serie de gastos en el flujo de caja** de los últimos 12 meses: el resultado del mes descuenta los gastos.
- **Ficha de cliente completa**: teléfono, dirección y notas. Teléfono y dirección son opcionales; el teléfono se guarda en crudo y se formatea al mostrarlo (`xxx xx xx xx`). En `/customers` aparecen las columnas nuevas (Teléfono, Dirección, Deuda) y las notas son la última columna de datos.
- **Deuda por cliente**: cada venta lleva el **importe cobrado**; la deuda del cliente es lo que falta por cobrar. El cobro es caja, no ganancia: no altera el beneficio de la venta. No se puede cobrar más de lo vendido.
- **Campo "Cobrado"** en el alta y la edición de venta.
- **Notas en compras, ventas y clientes** con icono: si no hay notas no aparece nada y al pasar el ratón por encima se lee la nota entera en un popover. Las compras, que no tenían campo de notas, lo reciben.
- **Pestaña "Métricas"** en el dashboard: KPIs globales, comparativas frente al mes anterior y listados métricos (margen por producto, clientes con deuda y reparto de gastos). Es una vista aparte, sin gráficos ni tablas de registros: el dashboard no se recarga.
- **Copias de seguridad desde la app**: un botón junto a la versión, en el pie. Crea una copia con fecha y hora, la deja en la carpeta `backups` y permite **descargarla**, **eliminarla** o **restaurar** desde una copia guardada o desde un archivo `.db` que tengas por ahí. Antes de restaurar se guarda sola una copia del estado actual (si restauraste lo que no era, vuelves atrás) y un archivo que no sea una base de datos válida se rechaza sin tocar nada.
- **Autocompletado del nombre de producto** en el alta y la edición de compra: al escribir, se desplegan los nombres de producto que ya tenés en tus compras, ordenados por cuántas veces los usaste. Se elige con un clic o con el teclado (`↑ ↓` para recorrer, `Enter` para elegir, `Esc` para cerrar) y **solo rellena el nombre del producto**: el resto del formulario se sigue escribiendo a mano. Ignora mayúsculas y acentos ("iphone" encuentra "iPhone 15"). Si no elegís ninguna sugerencia, el nombre se guarda tal cual: un producto nuevo siempre se puede escribir.
- **Selector de productos de la venta pulido**: la coincidencia se **resalta** dentro del nombre del producto y la lista se **recorre con el teclado** (`↑ ↓`, y `Enter` para marcar o desmarcar el producto activo). Su filtro ahora ignora mayúsculas y acentos, como el buscador del resto de la app.
- **Filtro por rango de fechas** en las listas de compras y ventas: los presets **"Este mes"**, **"Último trimestre"** (los tres meses que incluyen el actual) y **"Este año"**, o un rango a medida con dos fechas (desde y hasta). El filtro lo resuelve el servidor, no la lista: en compras mira la fecha de compra y en ventas la fecha de venta, y el rango incluye los dos extremos. Con un filtro activo, las compras o ventas **sin fecha no aparecen**.
- **Recibo imprimible de una venta**: desde el enlace **"Recibo"** de cada fila de la lista de ventas se abre el recibo de esa venta: los datos del cliente (nombre, teléfono y dirección), los productos vendidos con su cantidad y el total. Con el botón **"Imprimir o guardar como PDF"** se imprime en papel o se guarda como PDF (el PDF lo pone el diálogo de impresión del navegador, no la app). En la hoja sale **solo el recibo**: ni la cabecera de la app ni los botones, ni la línea de cabecera del navegador (con el nº y la fecha). Las **notas internas y los gastos asociados no aparecen** en el recibo: son información del vendedor.
- **El recibo de una venta se abre con los datos viajando**: al abrir el recibo desde la tabla de ventas, el cliente, la fecha, el total y los productos **viajan** desde su celda hasta el recibo, y vuelven a su celda al pulsar "← Volver". Es la misma animación que ya se veía al editar una venta, ahora también en el recibo y en los dos sentidos.

### Cambiado

- **El coste de compra es ahora el precio por unidad**: el campo de las compras (antes "Coste (€)") se llama **"Precio unidad (€)"** y guarda lo que pagaste por **una** unidad; el total del lote se deriva (precio unidad × cantidad) y la tabla de compras muestra las dos cifras: **"Coste (€)"** (el total del lote) y **"Precio unidad (€)"**. El formulario de alta y de edición muestra el **"Total del lote"** derivado, en vivo. La búsqueda por número busca por el precio unitario y por el total del lote. **Tus compras existentes no se convierten solas**: la app no reescribe tus datos, así que revisa cada compra y guarda en ella el precio por unidad (el total del lote se ve derivado en la fila, para que puedas ajustarlo hasta que cuadre con lo que pagaste).
- **Al editar una compra o una venta, el formulario ya no enfoca ningún campo**: al abrir la edición de una compra (`/buys/:id`) o de una venta (`/solds/:id`), el cursor **no** se queda metido en un campo. Se puede empezar a escribir o a leer el formulario sin que el foco salte a un input.
- **Al abrir "Nueva venta", el foco cae en el campo Cliente y la lista de clientes no se despliega**: el foco va al primer campo del formulario (Cliente) y la lista de clientes **no** se abre al entrar: se despliega al empezar a escribir (o con `↑ ↓` para recorrerla).
- **El recibo de una venta se abre desde la lista de ventas**: el enlace **"Recibo"** de cada fila sigue siendo la forma de abrirlo; la página de editar la venta ya no lleva ese enlace.

- **Los datos que viajan cambian de color antes de moverse**: al abrir el recibo de una venta (o al editar una), el cliente, la fecha, el total y los productos **salen ya con el color de su destino**: el color se funde en la posición de partida durante 80 ms y el resto del viaje (250 ms) es solo movimiento. En la vuelta (recibo → tabla) ocurre igual.

- **Las acciones de las filas son iconos, no palabras**: editar, borrar y renombrar ya no se escriben ("Editar", "Borrar", "Renombrar") sino que se muestran como iconos (lápiz, papelera). El nombre accesible se mantiene: el botón o enlace sigue teniendo su `aria-label` ("Editar Juan Pérez", "Borrar Funda iPhone 15"), así que los lectores de pantalla y el teclado no pierden nada. Aplica a compras, ventas, clientes, gastos, categorías de gasto y copias de seguridad.
- **El recibo de una venta va en su propia columna**: en la tabla de ventas, "Recibo" es una **última columna sin cabecera** (con su icono de documento) en lugar de un enlace suelto dentro de la columna de acciones.

- **El subtítulo del encabezado** de la app deja de ser la lista de módulos ("compras, ventas y clientes") y pasa a ser una frase: "Tu gestor personal para llevar tus cuentas al día".

- **Nuevo icono de la app**: el logo de la gráfica ascendente con la flecha verde sustituye al símbolo del euro. Los íconos de la app de escritorio (instalador, acceso directo, barra de tareas) y el favicon del web salen ahora **de una única fuente**: `desktop/icon-source.png` (PNG 1024x1024). Con `npm run icon` (en `desktop/`) se regeneran los íconos de escritorio y se sincroniza el favicon del web.

- **El color de un KPI es el mismo que el de su línea en la gráfica**: la línea de gastos del flujo de caja ya no es morada, es el ámbar de la cajita de "Gastos"; la de compras es el rojo de "Compras totales" y la de beneficio, el verde de "Beneficio". Cada métrica tiene un único color (token `--color-metric-*`), así que el número y su línea no pueden divergir. Como consecuencia cambian de color los KPIs que se confundían con otro: **la deuda y los clientes con deuda** pasan del ámbar al gris azulado (el ámbar ya es de los gastos), **el stock pendiente y su valor** al azul, **el resultado del mes** de la gráfica al violeta (el naranja de marca era demasiado parecido al ámbar de los gastos) y **las ventas totales** quedan en neutro, porque el verde es del beneficio. El cero de un beneficio deja de pintarse en naranja y queda en gris: un 0 no es un aviso.

- **La deuda por defecto de una venta es 0**: por defecto se asume que el comprador **paga el precio íntegro**. El campo **"Cobrado (€)"** pasa a ser opcional y **empieza vacío**: si escribes un importe, es lo que te pagó y la deuda es lo que falta (`precio − cobrado`); un `0` explícito significa "no me ha pagado nada". Las ventas que ya existían sin importe cobrado informado pasan a considerarse pagadas íntegras, **también cuando las restauras desde una copia de seguridad anterior**.
- **El popover de notas ya no tiene un ancho fijo**: la caja se ajusta al texto (mínimo 80 px, máximo 280 px) y el texto largo se parte en varias líneas en lugar de quedarse en una sola línea larga.
- **El popover de notas se puede usar con el ratón**: al salir del icono tarda una fracción de segundo en cerrarse y, si el puntero entra en la caja, se queda abierto. Así se puede leer y desplazar un texto largo con scroll. Entra y sale con una animación corta de opacidad y escala (se respeta `prefers-reduced-motion`).
- **La tabla de gastos se puede ordenar**: las cabeceras **Concepto**, **Categoría**, **Importe** y **Fecha** ordenan la lista con un clic (o con el teclado: Tab + Enter o espacio), como las tablas de compras, ventas y clientes.
- **La vista de gastos vive en `/expenses`**: la URL `/gastos` redirige a `/expenses`.
- **El filtro de fechas va en una sola línea**: los presets ("Todo", "Este mes"…) y la descripción del rango quedan a la izquierda; a la derecha, las dos fechas y el botón **"Quitar filtro"**, que ahora aparece siempre (y no hace nada cuando no hay filtro).
- **En la tabla de compras, el filtro de fechas se apila a la izquierda**: los presets, la descripción del rango y los campos Desde/Hasta se apilan en columna, y a la derecha queda el filtro de tags con su botón de gestión. En la tabla de ventas el filtro de fechas sigue como estaba, en una sola línea.
- **El modal de copia de seguridad** tiene los botones **"Crear copia"** y **"Restaurar"**, centrados y con más separación entre ellos.
- **La página ya no se mueve al cambiar de ruta ni al abrir un modal**: el hueco de la barra de scroll está siempre reservado (el contenido no se desplaza de lado al pasar de una lista larga a una ficha), al abrir un modal la página de fondo no se puede desplazar con la rueda y el modal ya no aumenta la altura de la página. Ese hueco reservado se pinta con **el mismo fondo que la app** y queda **a los dos lados**, para que el contenido siga centrado en la ventana. En dark mode, la barra de scroll se dibuja en oscuro: no se ve una franja de otro color ni una barra en claro sobre la app.
- **La barra de scroll lleva los colores de la app**: es fina, con la pista transparente (el hueco reservado no se ve como una franja) y el tirador redondeado en gris claro, o en gris oscuro en el modo oscuro, y se aclara al pasar el ratón por encima.

### Corregido

- **Crear una categoría en línea ya la usa**: al escribir el nombre de una categoría nueva y pulsar **"Crear y usar"**, la categoría queda **seleccionada** en el campo de categoría del gasto (antes se creaba pero el selector se quedaba vacío).
- **El total de cada categoría ya no sale "NaN €"**: el servidor manda el importe como `total_amount` y el web lo leía con otro nombre, así que el gestor de categorías mostraba "NaN €" en el total.
- **El nº de gastos y el total de cada categoría se actualizan al añadir, editar o borrar un gasto**: la lista de categorías se quedaba con las cifras viejas hasta recargar la página.

### Migraciones

- `006`: tabla `expenses`, tabla `expense_categories`, `customers.phone/address/notes` y `solds.paid_amount`.
- `007`: `buys.notes`.
- `008`: las ventas con `paid_amount = 0` pasan a `sale_price` (se asumen pagadas íntegras, sin deuda).
- `010`: las vistas `v_item_costs` y `v_sold_costs` pasan a usar el precio por unidad de la compra.
- `011`: tabla `tags` (con el catálogo `buy` o `sold`, el nombre único por catálogo y el color) y la columna `buys.tag_id` (borrar un tag deja las compras **sin etiqueta**, no las borra).

La `006` y la `007` son **aditivas** (columnas nuevas con valor por defecto y tablas nuevas): no reescriben ni borran datos de la base de datos existente. La `011` también es **aditiva**: añade una tabla nueva y una columna nueva en `buys` (que empieza vacía), así que **tus compras quedan intactas** y sin tag hasta que se lo pongas; y borrar un tag **nunca borra compras**, solo les quita la etiqueta. La `008` es una migración de **datos**: reescribe el importe cobrado de las ventas que nunca se informó (de `0` a su precio de venta) y no toca ninguna otra columna. La `010` **no reescribe datos**: solo cambia las vistas de las cifras, así que las compras que ya tenías conservan el total pagado en el campo y hay que corregirlas a mano (por eso el cambio de la columna "Coste (€)" a "Precio unidad (€)"). Si restaurás desde la app una copia de seguridad anterior a esta versión, sus compras vuelven con su valor anterior (la app **no** las convierte) y las vistas de esta versión siguen activas: revisa los precios de compra de esa copia. Para volver del todo al comportamiento anterior hay que **reemplazar el archivo de la base de datos** por una copia previa a la `010` (el botón "Restaurar" de la app solo restaura las filas, no las vistas).

## [0.1.1]

**Publicada el 2026-10-26**

### Añadido

- **El instalador en español**: Tauri 2.12 ya trae la traducción de NSIS, así que el bundle declara `bundle.windows.nsis.languages = ["Spanish"]` y deja los textos que usa en `desktop/nsis/Spanish.nsh` (customizable). Antes salía en inglés.
- **Un `.zip` con el instalador** para el cliente: el _Mark of the Web_ (la marca que Windows pone a los archivos descargados) es lo que dispara el aviso "Windows te protegió tu PC", y un archivo dentro de un zip no la lleva → el cliente descomprime y ejecuta **sin avisos** y sin necesidad de un certificado de firma de Windows. `npm run publish:new-version` lo sube a la release.
- **El sistema de versiones visible**: una fuente por artifact (`desktop/tauri.conf.json`, `web/package.json`, `server/package.json`) → `scripts/write-versions.mjs` genera `web/.env` y `server/version.json`, el server expone `GET /api/version` y el pie de la app muestra app, front y back.
- `.gitleaks.toml`: el escáner ya no reporta los artefactos de build de Rust ni la clave pública del updater (que es pública por diseño).

### Corregido

- `release.mjs` y `write-versions.mjs` leen sus JSON dentro de un `try/catch`: un archivo faltante o malformado ahora dice qué falló y dónde, en vez de reventar con un stack.
- La ruta de la **base de datos** la decide el server (canónica por plataforma y fallback a la legacy si la nueva está vacía) y el shell de Tauri dejó de pasar `SALEMANTEINER_DIR`: la app instalada y el dev ven los mismos datos.

## [0.1.0]

**Publicada el 2026-10-25**

### Añadido

- **La app de escritorio** (Tauri 2 + el server como _sidecar_): el web compilado y el server viajan dentro del instalador; la app **arranca sola** (el cliente no instala Node ni abre una terminal) y **se actualiza sola**.
- **Un solo origen**: el server sirve el `web/dist` con fallback de SPA → el web y la API viven en el mismo origen. El contrato de la API no cambia.
- **Auto-update con minisign** (gratis y obligatorio: Tauri no instala un artefacto sin firma). La clave privada nunca se commitea; la pública va en `tauri.conf.json`.
- `npm run build:app`: compila el front, compila el back, re-empaqueta el sidecar y genera el instalador, en un comando.
- `npm run publish:new-version`: mira qué versión está distribuida y publica **solo si la local difiere** (comparación semver: la misma no hace nada y un downgrade se niega).

## 0.0.0

- El gestor de **compras, ventas y clientes** con packs multi-producto, stock por unidad y validación transaccional (422 con el detalle de qué falta).
- El **dashboard**: 4 KPIs, flujo de caja de los últimos 12 meses, top 5 de productos y de compradores, en 4 pestañas ordenables.
- **Búsqueda que entiende**: texto, precios, cantidades (`x3`), fechas (`12/03/2025`) y pérdidas (`-30`), combinables.
- **100% local**: sin cuentas, sin nube, sin telemetría y sin peticiones a terceros.

[1.0.0]: https://github.com/RicardoD4W/SaleManteiner/releases/tag/v1.0.0
[0.1.1]: https://github.com/RicardoD4W/SaleManteiner/releases/tag/v0.1.1
[0.1.0]: https://github.com/RicardoD4W/SaleManteiner/releases/tag/v0.1.0
