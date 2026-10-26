# SaleManteiner — Contexto para agentes

> App **local** (React + Node, con shell de escritorio Tauri) para registrar **compras y ventas** de tu cuenta de Wallapop: un tracker de profitability para reseller.
> Este archivo es el **punto de entrada**: lo mínimo para trabajar sin contexto. El detalle vive en los docs enlazados de la raíz. Última actualización: 2026-10-26.

## 0. Reglas no negociables

1. **Verificación visual antes de cerrar cualquier feature que afecte a la UI.** Un test verde **no** es "se ve bien": hay que levantar la app, capturar las pantallas y **mirar las capturas**. El informe de cierre incluye las capturas revisadas. Si no se pudo mirar, el feature **no está cerrado** y se reporta como bloqueado — sin excepciones por "es un cambio chico" o "los tests pasan". Alcance y cómo se arma el arnés: [WORKFLOW.md §4](WORKFLOW.md#4-verificación-visual-no-negociable-para-cambios-con-ui).
2. **La BD del usuario no se toca.** Toda verificación (e2e, visual, scripts) corre contra una BD **temporal** (`SALEMANTEINER_DIR`), nunca `~/.salemanteiner`. Los datos que el usuario carga a mano son sacredos.
3. **Los gates antes de commitear**: `typecheck`, `lint`, `format:check` y los tests (unit + e2e) tienen que estar verdes. Si un gate no se puede correr, se dice; no se commitea a ciegas.
4. **Push, PR y merge son decisiones del usuario**, no del agente (salvo los work-unit commits de una implementación autorizada).

## 1. Mapa de documentos

| Doc                                      | Qué contiene                                                                                      | Leelo cuando…                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [ARCHITECTURE.md](ARCHITECTURE.md)       | Estructura del repo, stack, modelo de datos, ruta de la BD, reglas de código y convenciones de UI | Vas a tocar código o a cambiar el modelo         |
| [WEB.md](WEB.md)                         | Detalle técnico del frontend: rutas, TanStack Query, componentes, búsqueda, estilos, tests        | Tocás `web/**`                                   |
| [SERVER.md](SERVER.md)                   | Detalle técnico del backend: rutas, repos, migraciones, vistas SQL, errores, tests                | Tocás `server/**`                                |
| [PRODUCT.md](PRODUCT.md)                 | Qué es la app, decisiones de producto, roadmap, alcance, índice de features                       | Necesitás el "por qué" de una decisión           |
| [WORKFLOW.md](WORKFLOW.md)               | Arranque, comandos, gates, verificación visual, skills, flujo ODD, trampas del repo               | Empezás a trabajar o vas a commitear             |
| [DESKTOP.md](DESKTOP.md)                 | La app de escritorio (Tauri 2): sidecar, instalador, auto-update, versiones                       | Tocás `desktop/**` o la entrega al cliente       |
| [STATUS.md](STATUS.md)                   | Estado actual, pendientes, decisiones abiertas, historial                                         | Necesitás saber qué falta                        |
| [`odd/happy-path.md`](odd/happy-path.md) | Guion de humo del usuario (checklist de la UI)                                                    | Hay que verificar que un refactor no rompió nada |
| [`odd/tasks/`](odd/tasks/)               | Un doc por feature: specs (S#), tareas (T#) y Log (L#)                                            | Quieres el detalle histórico de un feature       |
| [`odd/HANDOFF.md`](odd/HANDOFF.md)       | Estado de la última sesión cerrada y cómo retomar                                                 | Retomás un trabajo interrumpido                  |
| [README.md](README.md)                   | Instalación y uso para una persona (no un agente)                                                 | El cliente o un humano nuevo lee el repo         |

## 2. Stack

| Capa             | Tecnología                                               |
| ---------------- | -------------------------------------------------------- |
| Frontend         | React 19 + TypeScript + Vite 8 + Tailwind 4              |
| Backend          | Node 20 LTS + Express 5 + TypeScript + better-sqlite3 13 |
| Validación       | Zod 4                                                    |
| Logging          | Pino 10 + pino-http 11                                   |
| Tests            | Vitest 5 (server + web) + Playwright (e2e)               |
| Linter / Formato | ESLint 10 + Prettier (flat config)                       |
| Escritorio       | Tauri 2 + Rust (shell), el server Node como sidecar      |
| Gestor Node      | fnm (`scripts/with-fnm.ps1`)                             |
| Paquetes         | npm workspaces: `web/`, `server/`, `desktop/`            |

Detalle y notas por capa: [ARCHITECTURE.md §2](ARCHITECTURE.md#2-stack).

## 3. Arranque

```bash
fnm install 20 && fnm use 20   # la primera vez
npm install                    # la primera vez
npm run dev                    # server :4000 + web :5173
```

- Frontend → <http://localhost:5173> · Backend → <http://localhost:4000/api/health>
- Escritorio: `npm run dev:desktop` (shell Tauri en modo dev).

Comandos: `typecheck`, `lint`, `format` / `format:check`, `test`, `test:e2e`, `build`, `build:desktop`, `publish:new-version`. Tabla completa: [WORKFLOW.md §2](WORKFLOW.md#2-comandos).

## 4. Gates y verificación

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test
```

- `format:check` **es** gate (el repo está normalizado con Prettier desde 2026-10-19).
- `npm run test:e2e` también es gate cuando el cambio toca flujos de la UI.
- **Verificación visual**: obligatoria para cambios con UI → [WORKFLOW.md §4](WORKFLOW.md#4-verificación-visual-no-negociable-para-cambios-con-ui). El checklist del usuario está en [`odd/happy-path.md`](odd/happy-path.md) y las capturas se miran con la herramienta `read`.

## 5. Reglas del repo (no negociables)

- **Importes en euros decimales** (SQLite REAL), nunca en céntimos. Validación: `EuroMoney = z.number().nonnegative().multipleOf(0.01)`.
- **`round2()`** en toda aritmética de importes (mitiga el error IEEE 754).
- **El coste de compra es el TOTAL pagado** (+ cantidad); el unitario se calcula con `round2(cost / quantity)` cuando hace falta.
- **El beneficio sale de las vistas SQL** (`v_item_costs`, `v_sold_costs`): son la única fuente de la verdad de las cifras, no la fórmula repetida en JS.
- **`POST /api/solds` es transaccional**: valida stock y hace rollback con **422** si no cubre.
- **`created_at` lo pone el INSERT**; **`purchase_date` y `sold_at` los gestiona el cliente** (si viene, pisa; si no, conserva; `null` borra).
- **Zod**: `.default()` **solo en create**, `.optional()` en update (nunca `CreateXInput.partial()`).
- **UI solo en español**, fechas `dd/MM/yyyy`, sin i18n.
- **Dark mode con `@custom-variant dark`** (clase-based): todo color hardcodeado lleva su contraparte `dark:`.
- **El borrado en cascada no tiene undo** (decisión de producto): audit trail en el log + aviso en la UI.

Detalle completo (modelo de datos, tokens, ordenamiento, API): [ARCHITECTURE.md §5-§7](ARCHITECTURE.md#5-reglas-del-repo-no-negociables).

## 6. Skills (obligatorio evaluarlas en cada pedido)

Antes de la primera lectura o edición del workspace: listar las skills candidatas del workspace, decidir **cargar / no cargar** con motivo, y **en caso de duda → cargar**. La evaluación es **por pedido** (no por sesión) y hay que dejarla escrita en el informe del turno.

Mapa de skills por workspace, reglas duras y cuándo NO cargar: [WORKFLOW.md §5](WORKFLOW.md#5-skills).

## 7. Estado actual y pendientes

- El modelo `buys + solds + sale_items + customers` está activo; cuatro vistas (Dashboard · Compras · Ventas · Clientes) y el borrado desde las tablas.
- En curso: la **app de escritorio** (Tauri 2 + sidecar) — cerrada en código, **falta la entrega**: rehacer el instalador firmado, publicar la `v0.1.1` y probar el auto-update de punta a punta.
- Decisión pendiente del usuario: la entrega de la rama `feature/app-de-escritorio` (50+ commits → **PR**, no merge a ciegas) y la de `feature/componentizar-y-optimizar` (merge a `master` o PR).

Lista completa de pendientes, riesgos asumidos y el estado de la revisión nativa: [STATUS.md](STATUS.md).

## 8. Fuera de alcance

Fotos · chat con compradores · publicar productos · multi-cuenta · push móvil · sync entre dispositivos · app móvil nativa · CSV (import/export) · scraping o captura automática de Wallapop.

## 9. Trampas del repo

| Trampa                                                                     | Qué hacer                                                                   |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npm --workspace X` no funciona desde dentro de un workspace               | `npm --prefix ..`                                                           |
| Un `tauri build` a secas empaqueta el **sidecar viejo**                    | siempre `npm run build:app`                                                 |
| Express 5: `:id` matchea `[^/]+` → nunca matchea paths de 2 segmentos      | el orden de las rutas importa (`/stock` antes de `/:id`)                    |
| Tailwind 4 **no** pone `cursor: pointer` en los `<button>`                 | ponerlo explícito                                                           |
| `<input type="number">` con validación nativa bloquea el envío             | los forms llevan `noValidate`: la validación es la de Zod                   |
| El binario de `gentle-ai` del PATH no cuenta para la revisión nativa       | hace falta el package-local (`<gentle-pi>/.gentle-ai/v4.2.0/gentle-ai.exe`) |
| El plugin de log de Tauri no arranca con `USERPROFILE`/`APPDATA` falseados | para sandboxear la app, dejar las carpetas reales del sistema               |

Más trampas y su explicación: [WORKFLOW.md §7](WORKFLOW.md#7-trampas-del-repo-aprendidas-a-golpes).
