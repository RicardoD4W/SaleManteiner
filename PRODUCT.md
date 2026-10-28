# Producto — SaleManteiner

> Qué es la app, qué decisiones de producto están tomadas y qué queda fuera de alcance.
> Referencia técnica: [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Qué es

App **local** (React + Node, ahora también de escritorio) para **llevar el control de tus compras, ventas y clientes**. Cargás las compras (coste, cantidad, gastos), después registrás las ventas (precio, gastos, cliente, qué productos se vendieron) y la app te dice si el negocio cierra números.

Está pensada para **cualquier tipo de usuario**: un particular que compra y vende, un negocio pequeño, un freelance con gastos y facturas. No hay un perfil único ni un canal concreto atado a la app.

- **Gestión manual únicamente.** La app no se conecta a ninguna plataforma externa: no hay captura automática, ni scraping, ni proxy. No hay código de scraping ni de proxy en el repo.
- **UI solo en español**, sin i18n. Fechas en `dd/MM/yyyy`. Importes en euros decimales.
- **Cuatro vistas** en el header: Dashboard · Compras · Ventas · Clientes.
- El borrado vive **en las tablas** (no en las páginas de edición), con doble confirmación cuando el registro tiene ventas asociadas.

## 2. Decisiones de producto vigentes

| #   | Decisión                                                                                                  | Por qué                                                                      |
| --- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| D1  | **Gestión manual**, sin scraping ni captura automática                                                    | La app no depende de ninguna plataforma externa: los datos se cargan a mano. |
| D2  | **Modelo de 4 tablas**: `buys`, `solds`, `sale_items`, `customers`                                        | Un pack = N items en una venta; una compra = N unidades.                     |
| D3  | **Importes en euros decimales** (SQLite REAL) con helper `round2()`                                       | Evita el error IEEE 754 al prorratear.                                       |
| D4  | **UI solo español**, fechas `dd/MM/yyyy`                                                                  | Sin i18n: una sola locale.                                                   |
| D5  | **Nombre del proyecto: SaleManteiner**                                                                    | —                                                                            |
| D6  | **Volumen esperado ~50 ventas/mes** → SQLite local basta              | Es lo que hace escalar de verdad (ver el spec de paginación).                |
| D7  | **Entrega manual del instalador**, sin Microsoft Store                                                    | El cliente es no técnico; se le pasa el instalador a mano.                   |
| D8  | **La app se actualiza sola** (updater firmado con minisign); el cliente **no maneja git**                 | El destinatario no usa la terminal.                                          |
| D9  | **La ruta de la BD la decide el server**, con fallback a la legacy si la ruta nueva está vacía            | App instalada y dev ven los mismos datos; nadie pierde lo que cargó.         |
| D10 | **Borrado en cascada sin undo** (audit trail en el log + aviso en la UI)                                  | Riesgo asumido explícitamente por el usuario: decisión de producto.          |
| D11 | **Una fuente de verdad por artifact de versión** (tauri.conf.json, web/package.json, server/package.json) | El versionado se genera, no se escribe a mano.                               |

