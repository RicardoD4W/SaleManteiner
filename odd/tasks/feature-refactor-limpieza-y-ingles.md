# Feature: limpieza de código muerto, código sin comentarios y programación en inglés

Barrido de los dos workspaces (`web/` y `server/`): se borra lo que no se usa, se sacan los comentarios del código (su conocimiento "por qué" se guarda en Engram) y los identificadores pasan a inglés. **Sin cambios de funcionalidad ni de aspecto.**

**Riesgo del feature**: item 3 (se tocan contratos que otros consumen: la API HTTP y las queries del server no se tocan, pero el barrido puede borrar algo que sí se usaba) — mitigado con los gates (typecheck, lint, format, tests) y la revisión del diff.

## Specs

### S1 — Borrar lo que no se usa

> "que cojan los archivos uno por uno y elimines aquello que no se use o sobre, por ej en web esta visual/, eso puede borrarse porqu no se usa para la app"

Regla:

- Se recorre archivo por archivo en `web/` y `server/`.
- Solo se borra lo que se puede **probar** que no se usa: grep sobre todo el repo (no solo el archivo), exports sin ningún import, imports/variables/parámetros sin uso, código comentado, `console.log` sueltos, stubs sin implementación.
- **El arnés de capturas visuales se borra** (`web/visual/` + `web/playwright.visual.config.ts` + el script `visual` de `web/package.json`): es una herramienta que se crea en el momento de resolver una spec, no código de la app.
- No se tocan: los tests unitarios, los e2e, `test-utils/`, las skills del workspace, `odd/`, el contrato HTTP, el esquema de la BD.

Criterio de aceptación: los gates pasan y el repo compila sin referencias rotas.

### S2 — Sacar todos los comentarios del código

> "Tmb quiero un refactor para eliminar todos los comenatrios del código, y si necesitas saber lo que hace x funcion archivo o lo que sea guardalo o en engram o en algun archivo temporal."

Regla:

- Se eliminan todos los comentarios (`//`, `/* */` y JSDoc) del código de `web/src`, `web/e2e` y `server/src`.
- **Antes** de borrar un comentario que explica un _por qué_ (una restricción, una rareza del browser, una decisión, una trampa), ese conocimiento se guarda en **Engram** (`mem_save`), un tema por observación.
- El código tiene que quedar legible por sus nombres y su estructura, no por comentarios.

Criterio de aceptación: no queda un solo comentario en el código de los dos workspaces, y el conocimiento no trivial está en Engram.

### S3 — La programación en inglés, la UI en español

> "Tambien quiero que cambies el estilo de programacion si bien lo que vera el usuario final es español, quiero que la programación este en ingles, nombres de clases, funciones, variables, metodos..."

Regla:

- Identificadores, componentes, funciones, variables, tipos, props, clases CSS y atributos `data-*` en **inglés**.
- El texto que ve el usuario final (labels, botones, mensajes de error, toasts, comentarios de la BD) queda en **español**.
- Los archivos cuyo nombre esté en español se renombran y se actualizan todos los imports.

Criterio de aceptación: no queda ningún identificador en español; los strings de UI intactos.

### S4 — Sin cambios de funcionalidad ni de aspecto

> "Además esta spec es solo de codigo, no implia cambios ne la funcioanlidad ni cambios visuales"

Regla: la app se comporta y se ve exactamente igual. Por eso **no aplica** la verificación visual no negociable (AGENTS.md §0.1): es una spec de código, no de UI. La regla se mantiene para los casos en los que se afecta la UI (ver S5).

### S5 — La verificación visual solo cuando se afecta la UI

> "añade si quieres la execpcion de que la verificacion visual no negociable es para casos donde se afecte a la ui"

Regla: AGENTS.md §0.1/§8.1 pasan a decir que la verificación visual es obligatoria **cuando el cambio afecta la UI**, y que el arnés se crea en el momento de resolver la spec (esta spec lo borra).

## Tasks

| ID  | Spec       | Ruta                                       | Commit |
| --- | ---------- | ------------------------------------------ | ------ |
| T1  | S1, S2, S3 | subagente `web/` (writer)                  | WU1    |
| T2  | S1, S2, S3 | subagente `server/` (writer)               | WU2    |
| T3  | S4, S5     | inline (padre) — AGENTS.md + nota          | WU3    |
| T4  | S1-S4      | inline (padre) — gates + revisión del diff | WU4    |

## Log

- **L1** (2026-10-22) — "ahora quiero que crees un sub agente para la carpeta web/ y otro para la carpeta server/ y que cojan los archivos uno por uno y elimines aquello que no se use o sobre, por ej en web esta visual/, eso puede borrarse porqu no se usa para la app. Tmb quiero un refactor para eliminar todos los comenatrios del código, y si necesitas saber lo que hace x funcion archivo o lo que sea guardalo o en engram o en algun archivo temporal. Tambien quiero que cambies el estilo de programacion si bien lo que vera el usuario final es español, quiero que la programación este en ingles, nombres de clases, funciones, variables, metodos..."
- **L2** (2026-10-22) — Decisión del usuario sobre el arnés visual: "te comento, eso se crea en el momento de resolver una spec, una vez la spec este resuelta no es necesario. Además esta spec es solo de codigo, no implia cambios ne la funcioanlidad ni cambios visuales, añade si quieres la execpcion de que la verificacion visual no negociable es para casos donde se afecte a la ui" → el arnés se borra (S1) y §0.1/§8.1 se ajustan (S5).
- **L3** (2026-10-22) — Los dos subagentes trabajan en paralelo sobre superficies disjuntas (`web/**` y `server/**`); los gates de cada uno son los de su workspace (los del root los corre el padre al final, para que uno no vea el árbol a medio hacer del otro).
- **L4** (2026-10-22) — El subagente de `server/` terminó bien: 0 archivos borrados (todo tiene import), 1 tipo muerto eliminado (`Euro`), `LOG_LEVEL` unificado (el logger lo importaba de `config.js` en vez de releer el env), 11 identificadores renombrados en `solds-repo.ts` (las claves del JSON de la API intactas: son el contrato HTTP), 26 observaciones en Engram y una prueba diferencial contra `HEAD` que demuestra que no cambió ni un SQL, ni un status, ni un body. El padre además borró `ISODateTime` y `Url` (schema común, sin usos) y los comentarios de las migraciones SQL (el porqué quedó en Engram).
- **L5** (2026-10-22) — El subagente de `web/` **falló a mitad** ("assistant reported an error") y dejó el workspace roto: `web/src/api/client.ts` con el `constructor(` mutilado (`function Object() { [native code] }(`), `web/e2e/clientes-flow.spec.ts` con el `toString(` mutilado, un renombre a medias del `kind` del diálogo de borrado (`compra`/`venta` → `buy`/`sale`) y el renombre del atributo `data-vt-nombre` → `data-vt-name` sin actualizar el e2e. Todo reparado por el padre (con los gates verificados en cada paso).
- **L6** (2026-10-22) — El padre terminó lo que faltaba del barrido de `web/`: unificó la clave del state de navegación en `armedRowId` (el subagente la había renombrado a medias: el writer usaba `armedRowId` y el reader miraba `armedRow`), renombró las clases CSS (`.vt-celda` → `.vt-cell`, `.vt-caja` → `.vt-box`, `.campo-transicion` → `.transition-field`), la custom property `--vt-nombre` → `--vt-name` y los identificadores sueltos que quedaban en español (`prefijo`, `ultima`, `celdaDerecha`, `filasEnDom`, `cliente`).
- **L7** (2026-10-22) — Estado final: `typecheck`, `lint`, `format:check`, 211 tests web + 176 server y 33/33 e2e verdes. Quedan en el código solo las directivas de eslint/TypeScript (funcionales, no son comentarios) y los strings de UI y los títulos de test en español.
