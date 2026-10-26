# Handoff — 2026-10-26

> Estado al cierre de la sesión. Para continuar: leé esto + `mem_context` de Engram + el Log del feature (`odd/tasks/feature-app-de-escritorio.md`).

## Dónde estamos

- **Rama**: `feature/app-de-escritorio` (todo pusheado a `origin`). Último commit: `97ad8c9`.
- **PR**: https://github.com/RicardoD4W/SaleManteiner/pull/new/feature/app-de-escritorio
- **Ramas también pusheadas**: `master` (`4ab47b1`) y `feature/componentizar-y-optimizar` (`c7621b6`).
- **Instalador**: el de la release 0.1.0 (36,5 MiB) está construido, pero **vuelve a estar viejo**: no lleva el fix de la ruta de la BD ni el auto-update. Hay que rehacerlo (ver "Pendientes").

## Lo que se terminó en esta sesión

| #   | Qué                                                                                                                                                                                                                                                             | Commit                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | **La ruta de la BD la decide el server** (canónica por plataforma + fallback a `~/.salemanteiner` si la canónica no tiene datos) y el shell de Tauri dejó de pasar `SALEMANTEINER_DIR`                                                                          | `574a1e1` + `1854a84`           |
| 2   | **El RDD nativo volvió a estar operativo**: faltaba el binario package-local de `gentle-ai` (el del PATH no cuenta) → se instaló compilando el source pineado v4.2.0                                                                                            | `393a422`, `1c27d9e`, `bd31ec9` |
| 3   | **Verificador independiente del cambio de la BD**: veredicto APTO, 0 bloqueantes, 5 observaciones → las 5 corregidas (la importante: la canónica nunca debe caer en `%LOCALAPPDATA%`, la carpeta que borra el desinstalador)                                    | `1854a84`                       |
| 4   | **`npm run build:app`**: la cadena completa (front + back + sidecar + instalador) en un comando, y el `build:desktop` de la raíz deja de empaquetar el sidecar viejo                                                                                            | `328efd6`                       |
| 5   | **El auto-update**: `check_update` → diálogo nativo → install firmado → reinicio, todo en Rust (el web no se toca)                                                                                                                                              | `957278f`                       |
| 6   | **`npm run publish:new-version`**: mira la versión distribuida y publica solo si la local difiere (comparación semver; un downgrade se niega)                                                                                                                   | `97ad8c9`                       |
| 7   | **El sistema de versiones**: `scripts/write-versions.mjs` genera `web/.env` + `server/version.json` desde las 3 fuentes (tauri.conf.json / web/package.json / server/package.json); el server expone `GET /api/version`; el front muestra las tres en un footer | este commit                     |

## Respuestas que quedaban pendientes de contestar al usuario

**Firmar el instalador (minisign) — qué hace falta y si es necesario**

- **Lo que falta: nada.** Las claves ya están en esta máquina:
  - `~/.salemanteiner/desktop-updater/updater.key` (privada)
  - `~/.salemanteiner/desktop-updater/updater.key.pub` (pública, y ya está en `desktop/tauri.conf.json` → `plugins.updater.pubkey`)
  - `~/.salemanteiner/desktop-updater/password.txt` (la password)
- **Para firmar el build**: `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` en el entorno (o `TAURI_SIGNING_PRIVATE_KEY_PATH` con la ruta, según lo que acepte la versión del CLI; la L10 del feature doc avisa de que la forma "path" solo sirve para `tauri signer sign`).
- **¿Es necesario? Sí, para el auto-update**: Tauri no permite un updater sin firma; sin ella el cliente no puede verificar la descarga y **no instala**. Es **gratis** (minisign) y ya está hecho.
- Lo que **no** hace falta y el usuario descartó: la **firma Authenticode de Windows** (esa es de pago, ~129 USD/año, y solo afecta al aviso de SmartScreen al descargar el instalador).

**El `GITHUB_TOKEN`**

- Dónde: GitHub → **Settings (perfil) → Developer settings → Personal access tokens**.
- Recomendado: **Fine-grained token** → _Resources: SaleManteiner_ → _Repository permissions: **Contents: Read and write**_ (eso alcanza para crear la release y subir los 3 archivos).
- Alternativa: token clásico con el scope `public_repo` (el repo es público).
- Se pasa por entorno: `GITHUB_TOKEN=...` (el script acepta `GITHUB_TOKEN` o `GH_TOKEN`).
- Alternativa: instalar `gh` (`winget install --id GitHub.cli`) y usar `gh auth login` → el token queda en el credential manager y se expone como `GH_TOKEN`.

## Pendientes

1. **Rehacer el instalador** (aplazado por el usuario): `npm run build:app` con las variables de firma en el entorno → `node desktop/scripts/release.mjs` → publicar la release (instalador + `.sig` + `latest.json`).
2. **Probar el auto-update de punta a punta**: publicar la `v0.1.1` y abrir la app instalada → debería preguntar y actualizarse sola. Requiere el paso 1.
3. **Decisión de entrega de la rama**: 50+ commits y ~11.000 líneas desde `master` → es un **PR** (o cadena de PRs), no un merge a ciegas.
4. **Reportar upstream el defecto de la fachada del RDD**: la captura autorizada rechaza los bindings canónicos del provider ("collectBindings must be the complete distinct current reviewer group in exact provider order"). Evidencia en AGENTS.md §12.8 y en L13/L14 del feature doc.
5. **Bugs abiertos**: la leyenda del chart del dashboard pisa la etiqueta del eje Y en móvil (390px) (§12.7 del AGENTS.md).

## Cómo retomar rápido

```bash
# 1. el estado
git log --oneline -3 && git status --short

# 2. los gates (los que tienen que estar verdes antes de commitear)
npm run typecheck && npm run lint && npm run format:check && npm run test

# 3. el arnés visual (NO vive en el repo: se arma en el momento)
#    → sandboxes en %TEMP%\gpSYjtf2\salemanteiner-sandbox (home falso con una COPIA de la BD real)
#    → el script visual: %TEMP%\gpSYjtf2\salemanteiner-sandbox\visual.mjs (BASE_URL / OUT_DIR por env)
#    → server: PORT=4312 SALEMANTEINER_WEB_DIR=web/dist, con USERPROFILE/APPDATA falseados
```

## Trampas de este repo (las que se czerwaron hoy)

- `npm --workspace X` **no** funciona desde dentro de un workspace: usar `npm --prefix ..`.
- El plugin de log de Tauri **no** arranca con `USERPROFILE`/`APPDATA` falseados ("failed to initialize plugin `log`: unknown path"): para sandboxear la app hay que dejar las carpetas reales del sistema.
- `os.homedir()` (Node) **sí** respeta `USERPROFILE` en Windows; las "known folders" de Tauri no.
- Un `tauri build` a secas empaqueta el **sidecar viejo** → siempre `npm run build:app`.
- El binario de `gentle-ai` del PATH **no** cuenta para la revisión nativa: hace falta el package-local (`<gentle-pi>/.gentle-ai/v4.2.0/gentle-ai.exe`), que instala `node scripts/install-gentle-ai.mjs` dentro del paquete.
