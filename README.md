# SaleManteiner

App web local (React + Node) para **registrar y mantener un histórico de compras y ventas** de tu cuenta de Wallapop. Tracker de profitability para reseller: carga las compras, después registra las ventas (con modal multi-select, packs y stock por unidad).

> Gestión manual únicamente. Captura automática y scraping descartados por diseño (riesgo de Términos de Servicio de Wallapop). CSV import/export fuera de la versión actual.

## Estado

MVP manual cerrado y operativo con el modelo `buys + solds + sale_items + customers`. El modelo legacy `sales` se dropeó en la migración 003; el actual gestiona compras con cantidad, ventas con packs multi-producto (validación de stock transaccional), clientes, dashboard con KPIs en euros decimales, dark mode y responsive.

La app tiene cuatro vistas en el header: **Dashboard · Compras · Ventas · Clientes**. El borrado de compras y ventas se hace desde las tablas (con confirmación y, si la compra tiene ventas, una segunda confirmación que nombra las ventas que se van a borrar). Lo mismo para los clientes.

Features cerradas y mergeadas en `master`:

- `feature-buys-and-solds` — modelo de 4 tablas + UI + endpoints REST + dashboard.
- `feature-dashboard-iteration-1` — 8 cambios de UI (cash flow chart, modal flow, top 5 colapsables, tablas ordenables).
- `feature-dark-mode` — toggle sol/luna con persistencia y anti-FOUC.
- `feature-purchase-date-and-manual-sold-at` — fechas editables por el cliente.
- `feature-delete-cascade-and-ux-polish` — borrar una compra con ventas ya no tira 500: 409 + cascada con confirmación y audit trail. Columna "Productos" en `/solds` y pulido de navegación.
- `feature-toasts-sileo` — confirmaciones por toast (sileo) en altas, ediciones y borrados.
- `feature-modal-venta-ux` — "+ Cambiar productos" conserva lo elegido, la cantidad se escribe sin seleccionar todo y cancelar vuelve al form.
- `feature-acciones-en-listas` — el borrado pasa a las tablas (y sale de las páginas de edición), el indicador de orden se queda en la misma línea que la cabecera y la navegación al editar relaciona la fila con el formulario.
- `feature-clientes-crud` — vista de Clientes (alta, edición y borrado en cascada).

Ver `odd/tasks/` para el detalle de cada feature (specs, tareas y log).

## Estructura

```text
SaleManteiner/
├── web/            # Frontend React 19 + Vite + TypeScript + Tailwind 4
├── server/         # Backend Node 20 + Express + TypeScript
├── odd/tasks/      # Feature docs por unidad de trabajo
├── AGENTS.md       # Contexto del proyecto (léelo primero)
└── package.json    # Workspaces de npm
```

## Requisitos

- **Node.js 20 LTS** (gestionado con [fnm](https://github.com/Schniz/fnm))
- **npm 10+** (incluido con Node 20)
- **Windows / macOS / Linux**

### Instalar Node 20 con fnm (si no lo tienes)

```bash
fnm install 20
fnm default 20
fnm use 20
node --version   # debe decir v20.x.x
```

## Instalación

Desde la raíz del proyecto:

```bash
npm install
```

Instala las dependencias de los tres `package.json` (raíz + `web/` + `server/`).

## Desarrollo

En dos terminales:

```bash
# Terminal 1: backend en http://localhost:4000
npm run dev:server

# Terminal 2: frontend en http://localhost:5173
npm run dev:web
```

O ambos a la vez:

```bash
npm run dev
```

## Otros comandos

```bash
npm run typecheck                     # TypeScript en web/ y server/
npm run lint                          # ESLint en web/ y server/
npm run format                        # Prettier en todo el repo
npm run format:check                  # Prettier en modo verificación (GATE: tiene que pasar)
npm run build                         # Build de producción de web/ y server/
npm test --workspaces -- --run        # Vitest en server (176 tests) + web (198 tests)
npm run e2e -w web                    # Playwright (31 e2e: flujos, borrado en cascada, view transitions, tablas)
npm run visual -w web                 # Verificación visual: capturas en web/visual/shots/ (ver AGENTS.md §8.1)
```

## Documentación

- **[AGENTS.md](./AGENTS.md)** — Contexto del proyecto: arquitectura, modelo de datos, decisiones tomadas, fases, convenciones de trabajo, skills cargadas.
- **[odd/tasks/](./odd/tasks/)** — Feature docs por unidad de trabajo (uno por feature/iteración; cada uno con specs, tareas y log).

## Licencia

Privado / sin licencia pública.
