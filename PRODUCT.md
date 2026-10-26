# Producto — SaleManteiner

> Qué es la app, qué decisiones de producto están tomadas y qué queda fuera de alcance.
> Referencia técnica: [ARCHITECTURE.md](ARCHITECTURE.md) · Estado y pendientes: [STATUS.md](STATUS.md).

## 1. Qué es

App **local** (React + Node, ahora también de escritorio) para **registrar compras y ventas de tu cuenta de Wallapop**. Es un **tracker de profitability para reseller**: cargás las compras (coste, cantidad, gastos), después registrás las ventas (precio, gastos, comprador, qué productos se vendieron) y la app te dice si el negocio cierra números.

- **Gestión manual únicamente.** La captura automática y el scraping de Wallapop están **descartados por diseño** (riesgo de Términos de Servicio). No hay código de scraping ni de proxy en el repo.
- **UI solo en español**, sin i18n. Fechas en `dd/MM/yyyy`. Importes en euros decimales.
- **Cuatro vistas** en el header: Dashboard · Compras · Ventas · Clientes.
- El borrado vive **en las tablas** (no en las páginas de edición), con doble confirmación cuando el registro tiene ventas asociadas.

## 2. Decisiones de producto vigentes

| #   | Decisión                                                                                                  | Por qué                                                              |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| D1  | **Gestión manual**, sin scraping ni captura automática                                                    | Riesgo de ToS de Wallapop (decisión del usuario).                    |
| D2  | **Modelo de 4 tablas**: `buys`, `solds`, `sale_items`, `customers`                                        | Un pack = N items en una venta; una compra = N unidades.             |
| D3  | **Importes en euros decimales** (SQLite REAL) con helper `round2()`                                       | Evita el error IEEE 754 al prorratear.                               |
| D4  | **UI solo español**, fechas `dd/MM/yyyy`                                                                  | Sin i18n: una sola locale.                                           |
| D5  | **Nombre del proyecto: SaleManteiner**                                                                    | —                                                                    |
| D6  | **Volumen esperado ~50 ventas/mes** → SQLite local basta; la paginación se hace en el server              | Es lo que hace escalar de verdad (ver el spec de paginación).        |
| D7  | **Entrega manual del instalador**, sin Microsoft Store                                                    | El cliente es no técnico; se le pasa el instalador a mano.           |
| D8  | **La app se actualiza sola** (updater firmado con minisign); el cliente **no maneja git**                 | El destinatario no usa la terminal.                                  |
| D9  | **La ruta de la BD la decide el server**, con fallback a la legacy si la ruta nueva está vacía            | App instalada y dev ven los mismos datos; nadie pierde lo que cargó. |
| D10 | **Borrado en cascada sin undo** (audit trail en el log + aviso en la UI)                                  | Riesgo asumido explícitamente por el usuario: decisión de producto.  |
| D11 | **Una fuente de verdad por artifact de versión** (tauri.conf.json, web/package.json, server/package.json) | El versionado se genera, no se escribe a mano.                       |

Las decisiones **descartadas** (scraping, modelo A+, mini-login con 2FA, cookies de sesión, exportación/importación CSV, cifrado de token) están en el Log de los feature docs correspondientes. No hay código de eso en el repo.

## 3. Roadmap

El plan por fases original quedó superado: el MVP manual se entregó y las fases de scraping/CSV se descartaron. El estado real:

| Fase                           | Estado          | Nota                                                                                                    |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------- |
| **0** Andamiaje                | ✅              | Monorepo `web/` + `server/`, Vite + TS, ESLint, Prettier, README.                                       |
| **1** Backend MVP + BD + CRUD  | 🔁 sustituida   | Reemplazada por `buys-and-solds` (T1-T7). El modelo legacy `sales` se dropeó en la migración 003.       |
| **2** Frontend MVP manual      | 🔁 sustituida   | Reemplazada por `buys-and-solds` (T8-T11). UI `/buys/*` y `/solds/*`, modal multi-select, autocomplete. |
| **3** Importación CSV          | ❌ descartada   | Fuera de la versión actual.                                                                             |
| **4** Scraping Wallapop        | ❌ descartada   | Descartada por el usuario (riesgo de ToS).                                                              |
| **5** Dashboard                | 🔁 sustituida   | T12 del feature: KPIs del modelo nuevo + tab "Compradores".                                             |
| **6** Exportación CSV          | ❌ descartada   | Fuera de la versión actual.                                                                             |
| **7** Settings + cifrado       | ⏸️ en pausa     | No aplica: el único dato sensible (el token de sesión) ya no existe.                                    |
| **8** Pulido + E2E + docs      | ✅ (2026-10-19) | `phase-8-polish-e2e-docs`: 6 e2e nuevos, README y AGENTS.md alineados.                                  |
| **9** App de escritorio        | 🔁 en curso     | Tauri 2 + sidecar. Cerrado el desarrollo; falta la entrega (instalador firmado + auto-update probado).  |
| **10** Paginación en el server | ⏸️ especificada | Spec en `odd/tasks/feature-paginacion.md`. El fix de la vista de cifras es prerrequisito.               |

## 4. Fuera de alcance

Subir fotos · chat con compradores · publicar productos · multi-cuenta · push móvil · sync entre dispositivos · app móvil nativa · importación/exportación CSV · scraping o captura automática de Wallapop.

## 5. Features cerradas (índice)

Cada feature tiene su doc en `odd/tasks/` con **specs (S#), tareas (T#) y Log (L#)**. Es el sitio al que ir cuando haya que entender _por qué_ el código es como es.

| Feature                                    | Qué aportó                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| `feature-buys-and-solds`                   | Modelo de 4 tablas + API + UI + dashboard (el modelo actual).                     |
| `feature-dashboard-iteration-1`            | Cash flow chart, top 5 colapsables, tablas ordenables.                            |
| `feature-dark-mode`                        | Toggle sol/luna con persistencia y anti-FOUC.                                     |
| `feature-purchase-date-and-manual-sold-at` | Fechas editables por el cliente.                                                  |
| `feature-delete-cascade-and-ux-polish`     | 409 + cascada transaccional con audit trail (en vez del 500).                     |
| `feature-toasts-sileo`                     | Confirmaciones por toast.                                                         |
| `feature-modal-venta-ux`                   | UX del picker de productos y del modal de venta.                                  |
| `feature-acciones-en-listas`               | Borrado desde las tablas + view transition + indicador de orden.                  |
| `feature-clientes-crud`                    | Vista de clientes con alta, edición y borrado en cascada.                         |
| `feature-componentizar-y-optimizar`        | Una fuente de la verdad, menos duplicación, `<Modal>` único, orden con una regla. |
| `feature-auditoria-calidad-codigo`         | Barrido de calidad (comentarios, naming, código muerto, duplicación).             |
| `feature-app-de-escritorio`                | Tauri 2 + sidecar + instalador + auto-update.                                     |
| `feature-phase-8-polish-e2e-docs`          | E2E de editar/borrar, dark mode y tabs del dashboard.                             |
