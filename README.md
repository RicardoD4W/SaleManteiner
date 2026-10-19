# SaleManteiner

App web local (React + Node) para **registrar y mantener un histórico de compras y ventas** de tu cuenta de Wallapop. Tracker de profitability para reseller: carga las compras, después registra las ventas (con modal multi-select, packs y stock por unidad).

> Gestión manual únicamente. Captura automática y scraping descartados por diseño (riesgo de Términos de Servicio de Wallapop). CSV import/export fuera de la versión actual.

## Estado

MVP manual cerrado y operativo con el modelo `buys + solds + sale_items + customers`. El modelo legacy `sales` se dropeó en la migración 003; el actual gestiona compras con cantidad, ventas con packs multi-producto (validación de stock transaccional), clientes, dashboard con KPIs en euros decimales, dark mode y responsive.

Features cerradas y mergeadas en `master`:

- `feature-buys-and-solds` — modelo de 4 tablas + UI + endpoints REST + dashboard.
- `feature-dashboard-iteration-1` — 8 cambios de UI (cash flow chart, modal flow, top 5 colapsables, tablas ordenables).
- `feature-dark-mode` — toggle sol/luna con persistencia y anti-FOUC.
- `feature-purchase-date-and-manual-sold-at` — fechas editables por el cliente.

Ver `odd/tasks/feature-buys-and-solds.md` y `odd/tasks/feature-dashboard-iteration-1.md` para el detalle.

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
npm run build                         # Build de producción de web/ y server/
npm test --workspaces -- --run        # Vitest en server (113 tests) + web (70 tests)
npm run e2e -w web                    # Playwright (13 e2e specs del flujo principal + edit/delete/dark mode/dashboard tabs)
```

## Documentación

- **[AGENTS.md](./AGENTS.md)** — Contexto del proyecto: arquitectura, modelo de datos, decisiones tomadas, fases, convenciones de trabajo, skills cargadas.
- **[odd/tasks/](./odd/tasks/)** — Feature docs por unidad de trabajo (uno por feature/iteración; cada uno con specs, tareas y log).

## Licencia

Privado / sin licencia pública.
