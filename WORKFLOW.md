# Workflow — SaleManteiner

> Cómo se trabaja en este repo: arranque, gates, skills y el flujo de ODD.
> Reglas del repo (código): [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. Arranque

```bash
# 1) Node 22+ (fnm)
fnm install 22   # solo la primera vez
fnm use 22

# 2) deps (solo la primera vez)
npm install

# 3) todo junto: server en :4000 + web en :5173
npm run dev
```

- Frontend → <http://localhost:5173>
- Backend → <http://localhost:4000/api/health>

Alternativas: `npm run dev:server` / `npm run dev:web` por separado · `npm run dev:desktop` (shell Tauri en modo dev).

## 2. Comandos

| Comando                           | Qué hace                                                                  |
| --------------------------------- | ------------------------------------------------------------------------- |
| `npm run typecheck`               | TS en `web/` y `server/`.                                                 |
| `npm run lint`                    | ESLint en los dos workspaces (`--max-warnings 0`).                        |
| `npm run format` / `format:check` | Prettier sobre `**/*.{ts,tsx,js,jsx,json,md,css}`.                        |
| `npm run test`                    | Vitest de `web/` + `server/`.                                             |
| `npm run test:e2e`                | Playwright (`web/e2e/`).                                                  |
| `npm run build`                   | Compila el server y el front.                                             |
| `npm run build:desktop`           | Atajo de `desktop/` → `build:app` (front + back + sidecar + instalador).  |
| `npm run publish:new-version`     | Publica una versión nueva **solo si** la local difiere de la distribuida. |
| `npm run write:versions`          | Genera `web/.env` + `server/version.json` (ya corre solo en dev/build).   |

## 3. Gates (antes de commitear)

Los cuatro tienen que estar verdes:

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test
```

- `format:check` **es** gate (desde 2026-10-19 el repo está normalizado con Prettier).
- El e2e (`npm run test:e2e`) también es gate cuando el cambio toca flujos de la UI.
- Si un gate no se puede correr, **se dice**: no se commitea a ciegas.

## 4. Skills

Las skills de cada workspace viven en `<workspace>/.agents/skills/<nombre>/SKILL.md` y están **versionadas**.

### Reglas duras

1. **SIEMPRE** cargar las skills relevantes **antes** de la primera lectura o edición de un archivo del workspace.
2. Se leen con `read` apuntando a la ruta completa (ej. `web/.agents/skills/tailwind-css-patterns/SKILL.md`).
3. Si la skill tiene `references/*.md` cuya regla general aplica, leerlas también.
4. Al delegar a un subagent, el task debe incluir la lista de skills a leer primero (no asumir que las descubre solo).
5. Si una skill contradice la intuición técnica, **gana la skill** (es la convención del repo).
6. Si al cargarla queda claro que no aplica, se anota el descarte. No se "descarga" a mitad de camino.

### Mapa de skills

**`server/.agents/skills/`** (antes de tocar `server/**`):

| Skill                       | Cubre                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `zod`                       | schemas, validaciones, refinements, `safeParse`, `flatten`… |
| `typescript-advanced-types` | tipos utilitarios, branded types, generics, narrowing       |
| `vitest`                    | tests: fixtures, helpers, mocking, organización             |

**`web/.agents/skills/`** (antes de tocar `web/**`):

| Skill                       | Cubre                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| `react-best-practices`      | performance (waterfalls, bundle, memo, derived state)            |
| `composition-patterns`      | APIs de componentes, evitar boolean props, state lifting         |
| `typescript-advanced-types` | tipos utilitarios, branded types, generics                       |
| `vite`                      | `vite.config.ts`, plugins, build, dev server, env vars           |
| `tailwind-css-patterns`     | utilities, responsive, dark mode, `@theme`, accesibilidad visual |
| `accessibility`             | WCAG 2.2, ARIA, foco, contraste, target size, labels, errores    |
| `frontend-design`           | jerarquía visual, spacing, tipografía, layout, atomic design     |
| `seo`                       | meta tags, OG, JSON-LD → **no aplica** a esta SPA (sin SSR)      |

**`desktop/.agents/skills/`** (antes de tocar `desktop/**`):

| Skill                 | Cubre                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------- |
| `tauri-v2`            | `tauri.conf.json`, comandos Rust, IPC, **capabilities y permisos**, updater, sidecars |
| `rust-best-practices` | Rust idiomático: ownership, `Result` en vez de `panic`, clippy, tests, documentación  |

**Criterio para `desktop/`**: `tauri-v2` se carga siempre que se toque la config, el shell, las capabilities o el updater; si el pedido es solo packaging o documentación, se puede seguir sin ella (salvo que el script defina rutas o nombres que el shell usa: `externalBin`, el sufijo del target triple, los permisos). `rust-best-practices` solo si se escribe o revisa **código Rust**.

### Cuándo NO cargar una skill

- Tareas puramente de git (commits, branches, merge) y documentación que no toca código (`AGENTS.md`, `README.md`, `odd/tasks/`).
- Búsqueda global de strings en el repo (`grep`/`find`), salvo que el resultado requiera editar archivos del workspace.
- Skills que el propio SKILL.md declara fuera de alcance (ej. `seo`).

## 5. Flujo de trabajo (ODD) y features

El detalle de cada unidad de trabajo vive en `odd/tasks/<feature>.md`:

- **Header** de 2-3 líneas + `## Specs` (S# con las cadenas textuales del usuario, verbatim) + `## Tasks` (T# con la ruta y el commit) + `## Log` (L1 = pedido original del usuario, y después correcciones, evidencia y decisiones).
- Un cambio de requisito se registra **verbatim** en el Log, reescribe solo el S# afectado y reabre solo su tarea.
- Los commits son **work units** revisables (~400 líneas cambiadas), con tests y docs al lado del comportamiento, y mensaje **Conventional Commits en inglés**.
- El **push**, el PR y el merge son decisiones del usuario, no del agente.

Al retomar una sesión: `mem_context` de Engram + el Log del feature (`odd/tasks/<feature>.md`) + el estado de git.
