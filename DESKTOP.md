# La app de escritorio (Tauri 2) — SaleManteiner

> Un shell de escritorio que **empaqueta la app sin reescribirla**: el web compilado (`web/dist`) y el server (`server/dist`) viajan dentro del instalador; el shell (Tauri 2) abre la ventana y el server corre como **sidecar** (un proceso Node que el shell lanza y cierra con ella).

- **Spec, tareas y Log**: `odd/tasks/feature-app-de-escritorio.md` (local, no versionado).
- **Rama**: `feature/app-de-escritorio`.
- **Workspace**: `desktop/` es un workspace npm (como `web/` y `server/`) con `@tauri-apps/cli`; el proyecto Rust vive **plano en `desktop/`** (`Cargo.toml`, `tauri.conf.json`, `capabilities/`, `src/`, `icons/`).

## 1. Decisiones

| Decisión                      | Qué implica                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Un solo origen**            | El server sirve el `web/dist` con fallback de SPA (`server/src/app.ts`) → el web y la API viven en el mismo origen y el shell apunta a una sola URL. **El contrato de la API no cambia**: `/api/*` igual, y lo que no existe sigue dando 404 JSON.                                                                                                                                                |
| **La BD en la ruta estándar** | `%APPDATA%\SaleManteiner` (Windows), `~/Library/Application Support/SaleManteiner` (macOS), `$XDG_DATA_HOME/SaleManteiner` (Linux). **Fuera de la carpeta de instalación** a propósito: el desinstalador de NSIS borra `$INSTDIR`. **La decide el server, no el shell** (ver [ARCHITECTURE.md §4](ARCHITECTURE.md#4-la-ruta-de-la-bd-la-decide-el-server)): el log dice cuál se usó (`dbSource`). |
| **Entrega manual**            | El instalador NSIS (~40 MB) lo pasa el usuario a mano al cliente. **Sin Microsoft Store.**                                                                                                                                                                                                                                                                                                        |
| **Auto-update**               | El cliente **no maneja git**: la app se actualiza sola. La firma del updater es con **minisign** (`tauri signer generate`): **gratis y obligatoria** (Tauri no deja desactivar el updater). La clave **pública** va en `tauri.conf.json`; la **privada nunca se comparte**.                                                                                                                       |
| **Firma de Windows**          | Es **otra** firma, aparte del updater. Sin firmar, Windows muestra _"Windows te protegió tu PC"_ → "Más información → Ejecutar". Con un certificado OV (desde ~129 USD/año) el editor aparece con nombre, pero **no** garantiza que desaparezca el aviso (desde 2026 las EV **tampoco** dan reputación inmediata) → la vía suave sin Store es **instalar en la máquina del cliente**.             |
| **El shell conduce todo**     | El check de update, el diálogo y la instalación viven en Rust (`desktop/src/lib.rs`). El web **no** llama a la API de Tauri, así que no hacen falta los paquetes JS `@tauri-apps/api` ni `@tauri-apps/plugin-*`.                                                                                                                                                                                  |

## 2. Requisitos (verificados en esta máquina)

1. **Visual Studio Build Tools 2022** con el workload _"Desarrollo para el escritorio con C++"_ → el linker (`cl.exe`). Instalado en `G:\DevTools\Visual Studio` (MSVC 14.51) → `cargo build` funciona.
2. **Rust ≥ 1.90** (aquí 1.99.1): `tauri` 2.12 lo exige.
3. **WebView2 Runtime**: ya viene en Windows 10/11 → Tauri **no** lo empaqueta ni lo descarga.
4. **Node**: para construir y para el sidecar → el instalador lo lleva dentro (el cliente **no** instala Node).
5. **Firma**: la clave minisign del updater (gratis, ya generada) y, si se quiere quitar el aviso de SmartScreen, un certificado OV (decisión pendiente).

## 3. Construcción

```bash
# la cadena COMPLETA, en orden (este es el comando de entrega)
npm run build:desktop     # = desktop/ → build:app
```

`build:app` (en `desktop/`) hace: `build:web` → `build:server` → `node scripts/pack-sidecar.mjs` → `tauri build`.

| Comando (en `desktop/`)       | Qué hace                                                        |
| ----------------------------- | --------------------------------------------------------------- |
| `npm run dev`                 | el shell en modo desarrollo                                     |
| `npm run build:app`           | front + back + sidecar + instalador (**el de entrega**)         |
| `npm run pack:sidecar`        | solo re-empaqueta el runtime (node + server + web)              |
| `npm run release`             | arma el `latest.json` del updater                               |
| `npm run publish:new-version` | publica la release **solo si** la versión local difiere         |
| `npm run icon`                | regenera los íconos desde el favicon (`web/public/favicon.svg`) |

**Ojo**: un `tauri build` a secas empaqueta el **sidecar viejo** → siempre `build:app`.

## 4. El auto-update

- **Claves minisign**: la **privada** en `~/.salemanteiner/desktop-updater/updater.key` (**fuera del repo**), con la password en `password.txt` al lado; la **pública** en `tauri.conf.json` (`plugins.updater.pubkey`). Si se pierde cualquiera de las dos, **no se pueden firmar más updates**.
- **Para firmar el build**: `TAURI_SIGNING_PRIVATE_KEY_PATH` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` en el entorno (la forma "path" solo sirve para `tauri signer sign`).
- **El endpoint** apunta a las GitHub Releases (`releases/latest/download/latest.json`): cada release publica el instalador, su `.sig` y el `latest.json`. El repo es público → el updater del cliente lo lee sin credenciales.
- **El flujo**: `npm run build:app` (con las variables de firma) → `node desktop/scripts/release.mjs` (arma el `latest.json`) → se publica la release en GitHub con los 3 archivos. El cliente abre la app → el shell hace `check_update()` → si hay versión nueva, un **diálogo nativo** pregunta → si acepta, descarga, **verifica la firma minisign** (si no calza, no instala) y reinicia la app. **Los datos no se tocan**: la BD vive en `%APPDATA%\SaleManteiner`, fuera de la carpeta que reemplaza el instalador.
- **Publicar una versión nueva**: `npm run publish:new-version` (desde la raíz o desde `desktop/`). El script mira **qué versión está distribuida** (lee el `latest.json` del endpoint) y publica solo si la local es distinta, con comparación **semver**: si es igual → no hace nada; si es **menor** → se niega (un downgrade no sirve de nada). Exige: instalador **firmado**, el token de GitHub (ver abajo), el árbol de trabajo limpio y el commit **pusheado**. Después crea la release (tag `vX.Y.Z` sobre el commit actual) y sube los 3 archivos.
- **Si no hay red o no hay release**, el check **falla en silencio** (solo un log): la app nunca se bloquea por no poder actualizarse.

### El token de GitHub

GitHub → **Settings (perfil) → Developer settings → Personal access tokens** → _Fine-grained_ → resource `SaleManteiner` → _Repository permissions: **Contents: Read and write**_ (o el token clásico con el scope `public_repo`).

El token se llama **`GH_TOKEN`** y el script lo lee de **`desktop/.env`** (con `process.loadEnvFile` de Node) o, si no está, del entorno:

```text
GH_TOKEN=github_pat_...
```

O sea: **basta con dejar el token en `desktop/.env`** y correr `npm run publish:new-version` sin exportar nada. `desktop/.env` está **gitignorado** (el `.gitignore` de la raíz ya cubre cualquier `.env`). Como `loadEnvFile` no pisa lo que ya está en el entorno, un `GH_TOKEN` exportado tiene prioridad sobre el del archivo. El script loguea **qué clave** usó, nunca el token. Alternativa: `gh auth login` → el token queda en el credential manager y se expone como `GH_TOKEN`.

### Qué hay en la release

| Archivo                               | Para qué                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| `SaleManteiner_<v>_x64-setup.exe`     | el instalador (lo usa el updater)                             |
| `SaleManteiner_<v>_x64-setup.zip`     | **el instalador comprimido**: es lo que se le pasa al cliente |
| `SaleManteiner_<v>_x64-setup.exe.sig` | la firma minisign (la verifica el updater)                    |
| `latest.json`                         | el manifiesto que el updater consulta (versión, URL y firma)  |

**Por qué el ZIP**: Windows marca los archivos descargados con el _Mark of the Web_, y esa marca es la que dispara el aviso "Windows te protegió tu PC". Un archivo dentro de un ZIP no la lleva → el cliente descomprime y ejecuta, sin avisos y **sin necesidad de un certificado de firma de Windows** (que cuesta plata). El updater sigue usando el `.exe` directamente, así que las actualizaciones tampoco pasan por ese aviso.

### El instalador, en español

El instalador de NSIS sale en español: Tauri 2.12 ya trae la traducción (`bundle.windows.nsis.languages = ["Spanish"]`) y deja los textos que usa en `desktop/nsis/Spanish.nsh` (se puede customizear ahí).

## 5. Firmar el instalador (la decisión de Authenticode)

Son **dos firmas distintas**:

| Firma                            | Para qué                                                              | Costo                                 |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| **minisign** (la del updater)    | que la app verifique que la descarga es auténtica antes de instalarla | gratis, ya hecha                      |
| **Authenticode** (la de Windows) | que Windows muestre el nombre del editor y no el aviso de SmartScreen | certificado de pago (OV ~129 USD/año) |

**Recomendación: no comprar el certificado ahora.** Con el ZIP el cliente no ve el aviso de SmartScreen, y si aun así lo ve, el camino es "Más información → Ejecutar" o, mejor, **instalar en la máquina del cliente** (se le pasa el archivo a mano y no hay descarga). Además, desde 2026 los certificados EV tampoco dan reputación inmediata en SmartScreen: el aviso puede aparecer igual.

Si algún día se decide comprarlo, el soporte ya está en el build de Tauri (`bundle.windows.certificateThumbprint` para el almacén de certificados de Windows, o `bundle.windows.signCommand` para `signtool` con un `.pfx`) y `bundle.windows.timestampUrl` + `tsp` para el sellado de tiempo. No hay nada que escribir en el repo hasta que exista el certificado.

## 6. Versiones (una fuente por artifact)

| Artifact | Fuente de verdad          |
| -------- | ------------------------- |
| app      | `desktop/tauri.conf.json` |
| front    | `web/package.json`        |
| back     | `server/package.json`     |

`scripts/write-versions.mjs` (raíz) lee las tres y escribe `web/.env` (`VITE_APP_VERSION`, `VITE_FRONT_VERSION`, `VITE_BACK_VERSION` → horneadas por Vite) y `server/version.json` (el manifiesto que el server lee en runtime). **Ambos están gitignorados**: son artefactos, no fuente. El script está enganchado a `dev:web` y `build:web` → nadie tiene que acordarse de correrlo.

El server expone `GET /api/version` → `{ app, front, back }` (la del back sale de su propio `package.json` — siempre cierta, también en el runtime empaquetado—; la de la app se puede forzar con `SALE_MANTEINER_APP_VERSION`; la del front viene del manifiesto). El web muestra las tres en el footer (`web/src/components/layout/AppVersion.tsx`) y cae a "dev" cuando no están inyectadas.

## 7. Estado verificado

- `cargo build` → `desktop/target/debug/salemanteiner-desktop.exe` ✓.
- **Instalador firmado 0.1.0**: 36,62 MiB (Node + server + web adentro) + `.sig` minisign ✓.
- **Instalado en un sandbox** (`%TEMP%\sm-e2e\app`): arranca, levanta el sidecar, sirve el web y la BD cae en el directorio temporal (`dbSource: explicit-dir`) → la BD real del usuario no se toca ✓. Captura revisada: dashboard en dark, 4 tabs, KPIs, chart y el footer con las versiones ✓.
- Los íconos salen del favicon del repo (`web/public/favicon.svg` → `tauri icon`).
- El smoke en frío (L11 del feature doc): la app instalada abre, guarda datos y el sidecar muere con la ventana.

## 8. Qué falta

1. ~~**Rehacer el instalador firmado**~~ → hecho (0.1.0 firmado y verificado; 0.1.1 firmado y publicado).
2. ~~**Probar el auto-update de punta a punta**~~ → hecho: la app instalada detecta la 0.1.1, pregunta, descarga, verifica la firma y se actualiza.
3. **Firma de Windows (Authenticode)**: **no comprar por ahora** (decisión del 2026-10-26): con el ZIP el cliente no ve el aviso de SmartScreen y, si lo ve, la vía suave es instalar en la máquina del cliente. El soporte en el build ya estádocumentado en §5.
4. ~~**Traducir el instalador al español**~~ → hecho (`bundle.windows.nsis.languages = ["Spanish"]`).
5. ~~**Falta probarlo en una máquina sin Node**~~ → hecho (2026-10-27): el `.zip` instalado en una máquina sin Node abre, guarda datos y funciona bien.
