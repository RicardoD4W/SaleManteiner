# Producto — SaleManteiner

> Qué es la app, qué decisiones de producto están tomadas y qué queda fuera de alcance.
> Referencia técnica: [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Qué es

App **local** (React + Node, ahora también de escritorio) para **llevar el control de tus compras, ventas y clientes**. Cargás las compras (coste, cantidad, gastos), después registrás las ventas (precio, gastos, cliente, qué productos se vendieron) y la app te dice si el negocio cierra números.

Está pensada para **cualquier tipo de usuario**: un particular que compra y vende, un negocio pequeño, un freelance con gastos y facturas. No hay un perfil único ni un canal concreto atado a la app.

- **Gestión manual únicamente.** La app no se conecta a ninguna plataforma externa: no hay captura automática, ni scraping, ni proxy. No hay código de scraping ni de proxy en el repo.
- **UI solo en español**, sin i18n. Fechas en `dd/MM/yyyy`. Importes en euros decimales.
- **Cinco vistas** en el header: Dashboard · Compras · Ventas · Clientes · Gastos.
- El borrado vive **en las tablas** (no en las páginas de edición), con doble confirmación cuando el registro tiene ventas asociadas.
- **Ficha de cliente completa**: nombre, teléfono, dirección y notas. Teléfono y dirección son opcionales; el teléfono se guarda en crudo y se formatea al mostrarlo (`xxx xx xx xx`).
- **Deuda por cliente**: cada venta lleva el importe cobrado; la deuda del cliente es lo que falta por cobrar. El cobro es caja, no ganancia: no toca el beneficio de la venta.
- **Gastos generales**: los gastos que no son ni compras ni ventas (alquiler, suministros, papelería…). Las categorías las crea el usuario. Restan del beneficio en el dashboard (beneficio neto), sin cambiar el significado del KPI de beneficio.
- **Notas**: en compras, ventas y clientes las notas se muestran con un icono; al pasar el ratón se lee la nota entera en un popover.
- **Pestaña "Métricas"** en el dashboard: una vista más con KPIs globales, comparativas frente al mes anterior y listados métricos (márgenes por producto, clientes con deuda, reparto de gastos). Sin gráficos ni tablas de registros: no recarga el dashboard.
- **Copias de seguridad y restauración desde la app**: botón junto a la versión, en el pie. Crea un archivo con fecha, lo deja en la carpeta `backups` y permite descargarlo, eliminarlo o **restaurar** desde una copia guardada o desde un archivo del disco. Antes de restaurar se guarda siempre una copia del estado actual, y un archivo que no sea una base de datos válida se rechaza sin tocar nada.

## 2. Decisiones de producto vigentes

| #   | Decisión                                                                                                       | Por qué                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Gestión manual**, sin scraping ni captura automática                                                         | La app no depende de ninguna plataforma externa: los datos se cargan a mano.                                                              |
| D2  | **Modelo de 4 tablas**: `buys`, `solds`, `sale_items`, `customers`                                             | Un pack = N items en una venta; una compra = N unidades.                                                                                  |
| D3  | **Importes en euros decimales** (SQLite REAL) con helper `round2()`                                            | Evita el error IEEE 754 al prorratear.                                                                                                    |
| D4  | **UI solo español**, fechas `dd/MM/yyyy`                                                                       | Sin i18n: una sola locale.                                                                                                                |
| D5  | **Nombre del proyecto: SaleManteiner**                                                                         | —                                                                                                                                         |
| D6  | **Volumen esperado ~50 ventas/mes** → SQLite local basta                                                       | Es lo que hace escalar de verdad (ver el spec de paginación).                                                                             |
| D7  | **Entrega manual del instalador**, sin Microsoft Store                                                         | El cliente es no técnico; se le pasa el instalador a mano.                                                                                |
| D8  | **La app se actualiza sola** (updater firmado con minisign); el cliente **no maneja git**                      | El destinatario no usa la terminal.                                                                                                       |
| D9  | **La ruta de la BD la decide el server**, con fallback a la legacy si la ruta nueva está vacía                 | App instalada y dev ven los mismos datos; nadie pierde lo que cargó.                                                                      |
| D10 | **Borrado en cascada sin undo** (audit trail en el log + aviso en la UI)                                       | Riesgo asumido explícitamente por el usuario: decisión de producto.                                                                       |
| D11 | **Una fuente de verdad por artifact de versión** (tauri.conf.json, web/package.json, server/package.json)      | El versionado se genera, no se escribe a mano.                                                                                            |
| D12 | **Los gastos generales son una tabla aparte**, no compras ni ventas                                            | Un gasto no genera stock ni entra en el beneficio de ventas: mezclarlo falsearía las cifras.                                              |
| D13 | **Las categorías de gasto las crea el usuario** (no hay catálogo sembrado)                                     | La BD del usuario no se toca con datos inventados; la UI ofrece crear la primera en línea.                                                |
| D14 | **El KPI de beneficio no cambia de significado**: se añaden "Gastos" y "Beneficio neto"                        | El usuario pidió"neto sin tocar el actual": las cifras que ya conoce siguen significando lo mismo.                                        |
| D15 | **La deuda se modela como importe cobrado por venta** (`paid_amount`)                                          | El cobro es caja, no ganancia: el beneficio sale de las vistas SQL y no se toca.                                                          |
| D16 | **Las notas se muestran con icono + popover** en compras, ventas y clientes                                    | La tabla se lee de un vistazo; el detalle aparece solo si pasas el ratón por encima.                                                      |
| D17 | **Las métricas van en su propia pestaña del dashboard**, no en el resumen                                      | El usuario pidió "no sobrecargar el dashboard": el resumen sigue igual y las métricas se ven aparte.                                      |
| D18 | **La copia de seguridad y la restauración son un feature de la app**, con copia de seguridad previa automática | El usuario tiene que poder confiar en la app con sus datos: una restauración equivocada es reversible y un archivo inválido no se aplica. |
