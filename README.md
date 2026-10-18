# SaleManteiner

App web local (React + Node) para **registrar y mantener un histórico de compras y ventas** de tu cuenta de Wallapop. Tracker de profitability para reseller: carga las compras, después registra las ventas (con modal multi-select, packs y stock por unidad).

> Gestión manual únicamente. Captura automática y scraping descartados por diseño (riesgo de Términos de Servicio de Wallapop). CSV import/export fuera de la versión actual.

## Estado

Backend + frontend operativos con el modelo `sales` legacy (entradas manuales). Migración en curso al modelo `buys + solds + sale_items + customers` documentado en `odd/tasks/feature-buys-and-solds.md`.

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
npm run typecheck      # TypeScript en web/ y server/
npm run lint           # ESLint en web/ y server/
npm run format         # Prettier en todo el repo
npm run build          # Build de producción de web/ y server/
```

## Documentación

- **[AGENTS.md](./AGENTS.md)** — Contexto del proyecto: arquitectura, modelo de datos, decisiones tomadas, fases, convenciones de trabajo, skills cargadas.
- **[odd/tasks/](./odd/tasks/)** — Feature docs por unidad de trabajo (uno por feature/iteración; cada uno con specs, tareas y log).

## Licencia

Privado / sin licencia pública.
