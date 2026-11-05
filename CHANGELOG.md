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

## [0.2.0]

**Sin publicar**

### Añadido

- **Gastos generales**: una vista nueva **Gastos** (`/gastos`, la quinta del header) con alta, edición, borrado, filtro por categoría y total de la lista. Los gastos son los que no son ni compras ni ventas (alquiler, suministros, papelería): viven en su propia tabla, no generan stock y no entran en el beneficio de ventas.
- **Categorías de gasto gestionadas por el usuario**: se crean, renombran y borran desde la propia vista. No hay catálogo sembrado → la base de datos del usuario no se toca con datos inventados. Borrar una categoría que tiene gastos devuelve 409.
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
- **Recibo imprimible de una venta**: desde el enlace **"Recibo"** de cada fila de la lista de ventas (o desde el botón "Recibo" de la página de editar la venta) se abre el recibo de esa venta: los datos del cliente (nombre, teléfono y dirección), los productos vendidos con su cantidad y el total. Con el botón **"Imprimir o guardar como PDF"** se imprime en papel o se guarda como PDF (el PDF lo pone el diálogo de impresión del navegador, no la app). En la hoja sale **solo el recibo**: ni la cabecera de la app ni los botones. Las **notas internas y los gastos asociados no aparecen** en el recibo: son información del vendedor.

### Cambiado

- **La deuda por defecto de una venta es 0**: por defecto se asume que el comprador **paga el precio íntegro**. El campo **"Cobrado (€)"** pasa a ser opcional y **empieza vacío**: si escribes un importe, es lo que te pagó y la deuda es lo que falta (`precio − cobrado`); un `0` explícito significa "no me ha pagado nada". Las ventas que ya existían sin importe cobrado informado pasan a considerarse pagadas íntegras, **también cuando las restauras desde una copia de seguridad anterior**.
- **El popover de notas ya no tiene un ancho fijo**: la caja se ajusta al texto (mínimo 80 px, máximo 280 px) y el texto largo se parte en varias líneas en lugar de quedarse en una sola línea larga.
- **El popover de notas se puede usar con el ratón**: al salir del icono tarda una fracción de segundo en cerrarse y, si el puntero entra en la caja, se queda abierto. Así se puede leer y desplazar un texto largo con scroll. Entra y sale con una animación corta de opacidad y escala (se respeta `prefers-reduced-motion`).
- **La tabla de gastos se puede ordenar**: las cabeceras **Concepto**, **Categoría**, **Importe** y **Fecha** ordenan la lista con un clic (o con el teclado: Tab + Enter o espacio), como las tablas de compras, ventas y clientes.
- **El filtro de fechas va en una sola línea**: los presets ("Todo", "Este mes"…) y la descripción del rango quedan a la izquierda; a la derecha, las dos fechas y el botón **"Quitar filtro"**, que ahora aparece siempre (y no hace nada cuando no hay filtro).
- **El modal de copia de seguridad** tiene los botones **"Crear copia"** y **"Restaurar"**, centrados y con más separación entre ellos.
- **La página ya no se mueve al cambiar de ruta ni al abrir un modal**: el hueco de la barra de scroll está siempre reservado (el contenido no se desplaza de lado al pasar de una lista larga a una ficha), al abrir un modal la página de fondo no se puede desplazar con la rueda y el modal ya no aumenta la altura de la página. Ese hueco reservado se pinta con **el mismo fondo que la app** y queda **a los dos lados**, para que el contenido siga centrado en la ventana. En dark mode, la barra de scroll se dibuja en oscuro: no se ve una franja de otro color ni una barra en claro sobre la app.
- **La barra de scroll lleva los colores de la app**: es fina, con la pista transparente (el hueco reservado no se ve como una franja) y el tirador redondeado en gris claro, o en gris oscuro en el modo oscuro, y se aclara al pasar el ratón por encima.

### Migraciones

- `006`: tabla `expenses`, tabla `expense_categories`, `customers.phone/address/notes` y `solds.paid_amount`.
- `007`: `buys.notes`.
- `008`: las ventas con `paid_amount = 0` pasan a `sale_price` (se asumen pagadas íntegras, sin deuda).

La `006` y la `007` son **aditivas** (columnas nuevas con valor por defecto y tablas nuevas): no reescriben ni borran datos de la base de datos existente. La `008` es una migración de **datos**: reescribe el importe cobrado de las ventas que nunca se informó (de `0` a su precio de venta) y no toca ninguna otra columna.

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

[0.2.0]: https://github.com/RicardoD4W/SaleManteiner/releases/tag/v0.2.0
[0.1.1]: https://github.com/RicardoD4W/SaleManteiner/releases/tag/v0.1.1
[0.1.0]: https://github.com/RicardoD4W/SaleManteiner/releases/tag/v0.1.0
