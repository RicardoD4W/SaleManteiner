# SaleManteiner

App web local (React + Node) para **registrar y mantener un histórico de ventas** de tu cuenta de Wallapop.

> ⚠️ **Aviso**: la captura automática prevista usa endpoints internos de Wallapop no documentados. Esto **viola los Términos de Servicio de Wallapop** y puede provocar el baneo de tu cuenta. La arquitectura mitiga el riesgo (módulo aislado, fallback a manual/CSV, rate limiting) pero no lo elimina. Úsalo bajo tu responsabilidad.

## Estado

Fase 0 — andamiaje del monorepo. Aún no hace nada útil.

## Estructura

```
SaleManteiner/
├── web/            # Frontend React 18 + Vite + TypeScript + Tailwind
├── server/         # Backend Node 20 + Express + TypeScript
├── scripts/        # Utilidades (setup del entorno con fnm)
├── PLAN.md         # Plan completo del proyecto (léelo primero)
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

- **[PLAN.md](./PLAN.md)** — Plan completo del proyecto: requisitos, arquitectura, fases, decisiones tomadas.

## Licencia

Privado / sin licencia pública.