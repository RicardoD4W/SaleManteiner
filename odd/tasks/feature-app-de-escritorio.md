# Feature: convertir la web en "app de escritorio" (o dejarla como está)

> El usuario pide una spec para **detallar y afinar cómo enfrentar** el paso de "web local en el navegador" a "ejecutable / aplicación de escritorio": **"quiero ver ventajas y desventajas que procesos podemos hacer y que es mejor y más optimo o si es mejor dejarlo como está"**.
>
> Después el usuario aclaró el destinatario: **"es para un cliente muy torpe con la tecnologia, quiero que sea facil y tenga un icono que le de click y se ejecute solo"** → eso **define** la ruta (ver S3/S4).
>
> Esta spec **no implementa nada**: compara las opciones con datos medidos de este repo y de esta máquina, recomienda un camino y deja las decisiones abiertas para que las cierre el usuario.

## El problema, desglosado

"Convertir la web en un ejecutable" son en realidad **cuatro problemas distintos**, y cada opción los resuelve de forma diferente:

| #      | Problema            | Qué falta hoy                                                                                                                 | Dificultad         |
| ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **P1** | **El arranque**     | Hoy: `npm run dev` (2 procesos: server :4000 + Vite :5173) y una pestaña                                                      | Trivial            |
| **P2** | **La ventana**      | Hoy: una pestaña con barra de direcciones y pestañas de fondo                                                                 | Trivial (modo app) |
| **P3** | **La distribución** | Hoy: `git clone` + `npm install` + Node instalado                                                                             | Media              |
| **P4** | **El runtime**      | El backend es **Node + `better-sqlite3` (nativo)**: cualquier empaquetado tiene que decidir dónde vive ese Node y ese `.node` | **La clave**       |

El detalle que define todo lo demás: **la app ya es local-first**. Los datos viven en `~/.salemanteiner/data.db` y la API es `127.0.0.1`. Convertirla en "app de escritorio" **no** le da nada que hoy no tenga (offline, datos locales, sin cuentas). Lo que gana es **ergonomía** (P1+P2) y, si se distribuye, **instalabilidad** (P3). Y paga con un runtime que hay que mantener.

## Specs

### S1 — La decisión va con datos, no con suposiciones

> "quiero ver ventajas y desventajas que procesos podemos hacer y que es mejor y más optimo o si es mejor dejarlo como está"

- Comparar **todas** las opciones viables con **medidas reales** de este repo (tamaño del build, peso de las dependencias nativas, dependencias del server) y de esta máquina (WebView2, Rust, Go).
- El objetivo de la spec es **poder decidir "dejarlo como está"** si esa es la mejor respuesta. La comparación tiene que incluir explícitamente el coste de mantener cada opción.
- La spec **no arranca la implementación**: cierra con una recomendación y las decisiones que el usuario tiene que tomar.

### S2 — La app tiene que seguir siendo la misma app

> "como convertir esta web en un ejecutable o una aplicacion de escritorio"

- **El web no se reescribe**: ni la UI, ni las rutas, ni los schemas, ni las vistas SQL. El `web/dist` compilado (6,9 MB) es lo que se empaqueta.
- **El server no se reescribe**: el `server/dist` (238 KB) es lo que se empaqueta. La API y sus contratos quedan intactos.
- La web llama a la API con **rutas relativas** (`/api/...`) → con un solo origen, el web compilado se sirve tal cual: **un origen, un puerto**.
- La BD sigue en la carpeta del usuario (`~/.salemanteiner/` o la que elija) → **los datos no se mueven ni se migran**.

### S3 — El destinatario decide la forma (RESPONDIDO)

> "es para un cliente muy torpe con la tecnologia"

**Lo que esto descarta de entrada**:

- **El desarrollo como distribución**: el cliente no va a clonar el repo ni a instalar Node. Un acceso directo que arranque `npm run dev` **no sirve** (terminal, Node, dos procesos).
- **La PWA como distribución**: la PWA es el _shell_; el backend sigue siendo un proceso Node → el cliente tendría que levantar el server → no sirve.
- **Cualquier opción que exija al cliente "instalar dependencias"**: queda solo la que **trae su propio runtime**.

**Lo que sí tiene que cumplir** (→ S4): que el cliente **haga doble clic en un icono y la app funcione**. Ni una terminal, ni un `npm install`, ni una carpeta que abrir a mano.

### S4 — Criterio de aceptación: "un icono que se ejecuta solo"

> "quiero que sea facil y tenga un icono que le de click y se ejecute solo"

Para **el cliente**, la app tiene que cumplir esto:

1. **Un icono en el escritorio** (o en el menú de inicio) con el nombre de la app.
2. **Doble clic** → se abre **una ventana propia** (sin barra de direcciones, sin pestañas, sin consola de por medio).
3. **No hace falta instalar nada más**: ni Node, ni Python, ni "abrir una carpeta y ejecutar un archivo".
4. **Los datos son suyos y están en su máquina**: el cliente puede hacer una copia del archivo `.db`.
5. **No ve errores**: si algo falla, la ventana muestra un mensaje, no una consola con un stack trace.
6. **Se actualiza solo** (o al menos no hay que hacer `git pull`).

### S5 — Las decisiones de entrega (RESPONDIDO)

> "quiero pasrale yo el ejecutable o el instalador, no quiero que abra la ms store"
>
> "me gusta el auto update, vamos a usarlo. el usuario no maneja git"

1. **Entrega**: el instalador **NSIS** (~40 MB) lo pasa el usuario a mano al cliente. **Sin Microsoft Store.**
2. **Auto-update**: el cliente **no maneja git** → la app **se actualiza sola**. La firma del updater es con **minisign** (`tauri signer generate`): **gratis y obligatoria** (Tauri no deja desactivar el updater). La clave **pública** va en `tauri.conf.json`; la **privada nunca se comparte**. Hay que publicar los instaladores en un endpoint (GitHub Releases o un `/updates` propio).
3. **Firma de Windows**: es **otra** firma, aparte del updater. Sin firmar, Windows muestra _"Windows te protegió tu PC"_ → "Más información → Ejecutar". Con un certificado OV (desde ~129 USD/año) el editor aparece con nombre, pero **no** garantiza que desaparezca el aviso (desde 2026 las EV **tampoco** dan reputación inmediata). **La vía suave sin Store es instalar en la máquina del cliente**: si el archivo no viene descargado, no hay aviso. → **Pendiente**: comprar el certificado o asumir el aviso.
4. **La BD**: `%APPDATA%\SaleManteiner\data.db` (Windows), `~/Library/Application Support/` (macOS), `$XDG_DATA_HOME/` (Linux) → lo canónico para datos de app. **Fuera de la carpeta de instalación** (que es `%LOCALAPPDATA%\SaleManteiner\`): una instalación por máquina haría esa carpeta no escribible y el desinstalador borra `$INSTDIR`. Se respetan `SALEMANTEINER_DIR`/`SALEMANTEINER_DB`, y **si la ruta nueva está vacía pero existe el `~/.salemanteiner/data.db` de siempre, se usa el viejo** → nadie pierde datos.

## Las opciones, con números de este repo

**Medidas (2026-10-25, esta máquina):**

| Qué                                     | Tamaño / dato                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `web/dist` (el JS que se empaqueta)     | **6,9 MB** (el bundle mayor 776 KB, `recharts` 369 KB)                                                   |
| `server/dist`                           | **238 KB**                                                                                               |
| `better-sqlite3` (nativo, el peso real) | **27 MB** (se puede podar al build de la plataforma: ~3-5 MB)                                            |
| Deps del server (el resto, JS puro)     | express, cors, pino, pino-http, zod → **~2 MB**                                                          |
| WebView2 runtime en esta máquina        | **155.0.4283.62, ya instalado** → Tauri/Wails no descargan nada                                          |
| Rust / Go / Node                        | cargo **1.87** ✓ · go **1.26.1** ✓ · node **22.23** ✓                                                    |
| `node:sqlite` (built-in de Node)        | **funciona sin flag** en Node 22.23 (solo un `ExperimentalWarning`) → podría reemplazar `better-sqlite3` |

### O0 — Lanzador + el server sirve el web compilado — **ya no alcanza para el cliente**

- El server pasa a servir `web/dist` (con el fallback de SPA para `/buys`, `/solds`, `/customers`) → **un solo origen en `http://localhost:4000`**.
- Un acceso directo / script que levanta el server y abre Edge o Chrome en modo app.
- **Resuelve P1 + P2 con ~1 día y 0 MB**, pero **exige Node en la máquina** → para el cliente de S3 **no sirve**.
- **Importante: es el habilitador de todo lo demás** (T2). Sigue siendo el primer paso aunque el destino sea otro.
- ⚠️ El server hoy devuelve JSON 404 en cualquier ruta desconocida → el `express.static` y el fallback de SPA tienen que ir **antes** del catch-all, o el web no carga.

### O1 — PWA (instalable desde el navegador) — **no alcanza para el cliente**

- `manifest.webmanifest` + iconos + service worker → icono en el menú de inicio, ventana propia, sin barra de direcciones.
- Instalable desde `localhost` (origen seguro) sin más. **0 MB.**
- **Pero**: el backend sigue siendo un proceso Node → el cliente tendría que tener Node y levantar el server → **descartada como forma de entrega** (S3). Sigue siendo útil **para el desarrollo** y como **respaldo** si el cliente prefiere no instalar nada.

### O2 — Electron

- El server corre **dentro del proceso main** (Electron trae Node) → `.exe` de verdad, con instalador, icono y autoupdate (`electron-updater`).
- **Ventajas**: el camino más directo y mejor documentado; el backend no se toca (salvo el rebuild del nativo); el runtime ya viene incluido y es el mismo Node.
- **Desventajas**: **instala ~150-250 MB** (Chromium ~120 MB + Node ~30 MB) → para un cliente que descarga un instalador, es una descarga grande; `better-sqlite3` **hay que recompilarlo para el ABI de Electron** (`@electron/rebuild`) en cada build; el doble runtime que mantener.
- **Veredicto: funcional pero caro**. Solo si el cliente va a instalar la app muchas veces en máquinas lentas.

### O3 — Tauri 2 + el server como _sidecar_ — **LA RECOMENDACIÓN**

- La ventana la hace el **WebView2 del sistema** (ya instalado en Windows 10/11 → el instalador **no lleva Chromium**) y el backend sigue siendo el server de Node, empaquetado como **sidecar** (proceso que Tauri lanza, vigila y cierra).
- El runtime de Node viaja **dentro** del instalador (node oficial + el server + sus deps podadas) → **el cliente no instala nada**.
- **Ventajas**: instalador de **~30-40 MB** (comprimido), un solo archivo que instalar, autoupdate de serie, el backend **no se reescribe** (es el mismo `server/dist`) y el shell es chico (Tauri tiene guía oficial de "Node.js como sidecar").
- **Desventajas**: hay que meter **Rust** en el stack (solo para el shell); **dos procesos** que supervisar; el WebView2 **no es el Chromium del e2e** (es Edge) → los e2e siguen corriendo en Chromium y la app real en WebView2 (**dos motores que verificar**); y el ejecutable sin firmar dispara el aviso de SmartScreen (→ S5.2).
- **Veredicto: la opción que cumple S4 con el menor instalador y sin reescribir el backend.**

### O4 — Wails (Go) — descartada

- Mismo modelo que Tauri (WebView2 + binario chico), pero el shell es Go → obliga a **reescribir el backend en Go** o a mantener un sidecar Node poco documentado en Wails.
- Go está instalado ✓, pero el costo real es la reescritura del server: desproporcionado para esta app.

### O5 — Mover los datos al navegador (SQLite en WASM / OPFS) → PWA pura, sin runtime — **la alternativa más suave para el cliente**

- Los repos y las migraciones se ejecutan contra **SQLite compilado a WASM** en el navegador (OPFS) → la app es **una PWA instalable, offline, sin Node y sin procesos**: el cliente abre un enlace, le da "Instalar" y tiene un icono. **0 MB y sin instalador** (ni SmartScreen, ni nada que instalar).
- **Ventaja máxima**: es la experiencia más suave posible para un cliente que no sabe de tecnología, y **se actualiza sola** (el enlace siempre sirve la última versión).
- **Desventajas**: es **reescribir la capa de datos** (el `openDb`, las migraciones, las vistas SQL, los repos; `better-sqlite3` → `wa-sqlite` y el `db.transaction()` no existe: hay que shimarlo) → días de trabajo y riesgo sobre **la única fuente de la verdad** (las vistas `v_item_costs` / `v_sold_costs`); los datos pasarían a vivir en el perfil del navegador (**borrar los datos del navegador = borrar las ventas**: hay que exportarlos); y se **pierde** el server (hoy se puede consultar la BD desde otro proceso).
- **Veredicto: la mejor experiencia para el cliente, pero es otro proyecto** (y arriesga la robustez de los datos). Se anota para el futuro (si algún día hace falta sincronizar entre máquinas, la PWA es la base natural).

## La comparación, de frente

| Opción                       | Resuelve         | ¿Icono que arranca solo para el cliente? | Instalador | Reescribe el backend        | Mantenimiento | Veredicto            |
| ---------------------------- | ---------------- | ---------------------------------------- | ---------- | --------------------------- | ------------- | -------------------- |
| **O0 lanzador**              | P1 + P2          | **no** (necesita Node)                   | **0 MB**   | no                          | bajo          | Solo para desarrollo |
| **O1 PWA**                   | P2 (+P1 parcial) | **no** (necesita el server en marcha)    | **0 MB**   | no                          | bajo          | Solo para desarrollo |
| **O2 Electron**              | todo             | sí (pero descarga 200 MB)                | 150-250 MB | no (con rebuild del nativo) | medio         | Descartado (peso)    |
| **O3 Tauri 2**               | todo             | **sí**                                   | 30-40 MB   | no (sidecar)                | medio         | **Elegida**          |
| **O4 Wails**                 | todo             | sí                                       | 10-30 MB   | **sí** (Go)                 | alto          | Descartado           |
| **O5 datos en el navegador** | todo             | **sí, y sin instalador**                 | 0 MB       | **sí** (capa de datos)      | alto          | Alternativa a futuro |

**El razonamiento de fondo**: con S3/S4 respondidas, **el runtime deja de ser opcional** (el cliente no puede instalar Node) → el criterio pasa a ser **"instalador chico + cero conocimientos + el backend sin reescribir"** → eso deja a **O3** (Tauri 2) como la única que cumple todo sin reescribir la capa de datos. **O5** la cumple más rápido de usar (ni instalador) pero a costa de reescribir la capa de datos y de mover los datos al perfil del navegador.

## Requisitos nuevos (hoy no hay nada de esto en la máquina)

1. **Visual Studio Build Tools 2022** con el workload _"Desarrollo para el escritorio con C++"_ + el Windows SDK: **sin `cl.exe` no hay linker** y `cargo build` falla para el target `x86_64-pc-windows-msvc` (<https://aka.ms/vs/17/release/vs_BuildTools.exe>, ~5-8 GB).
2. **WebView2 Runtime**: ya viene en Windows 10/11 (aquí 155.0.4283.62) → Tauri no lo empaqueta.
3. **Rust**: `rustc` 1.87 con el target msvc (ya instalado). Sin el Build Tools no compila.
4. **Node**: para construir (ya está) y **para el sidecar** → el instalador lo lleva dentro (el cliente **no** instala Node).
5. **Firma**: un certificado OV si se quiere firmar el ejecutable (pendiente) y **la clave minisign del updater** (gratis).

## Recomendación

1. **T2 — el habilitador (sigue igual)**: que el server sirva el `web/dist` con el fallback de SPA → **un solo origen**. Es útil por sí solo (hoy "producción" son 2 procesos), lo necesita el sidecar de Tauri (el web y la API en el mismo origen) y **no bloquea** ninguna decisión.
2. **O3 — Tauri 2 + el server como sidecar**:
   - El **sidecar** = node oficial + `server/dist` + sus deps podadas (con `better-sqlite3` prebuilt para el ABI de node → no hay que recompilar nada).
   - El **shell** (Rust/Tauri): abre la ventana apuntando a `http://127.0.0.1:<puerto libre>`, **sin consola** (el sidecar se lanza con `CREATE_NO_WINDOW`), espera al `/api/health`, y **cierra el server** al salir.
   - **Un solo origen**: el web compilado lo sirve el propio sidecar (→ por eso T2 va primero).
   - **Icono**: `tauri.conf.json` + `icon.ico` → acceso directo en el escritorio y el icono de la app.
   - **Instalador** (NSIS) + **auto-update**; y el aviso de SmartScreen se resuelve firmando (S5.2) o aceptando el "Más información → Ejecutar" (1 clic extra la primera vez).
3. **La BD del cliente**: `%LOCALAPPDATA%\SaleManteiner\data.db` (o la que ya usa el repo) → **el mismo path que hoy**, para que los datos no "desaparezcan".
4. **Auto-update siempre** (decidido el 2026-10-25): el cliente no maneja git → la app se actualiza sola con el updater de Tauri (firma minisign, gratis y obligatoria). El hosting de los releases es la única pieza que falta decidir (GitHub Releases o un endpoint propio).
5. **Si el cliente se resiste a instalar nada**: **O5** es el camino (PWA con los datos en el navegador) → es un proyecto aparte, no una fase de este.

## Riesgos

- **Item 3 (contratos que otros consumen)**: que el server sirva el web cambia su comportamiento (el catch-all 404 en JSON, el orden de los middlewares, el fallback de SPA). Hay que pinearlo con tests de rutas (p. ej. `GET /` → HTML, `GET /buys` → HTML, `GET /api/noexiste` → 404 JSON).
- **Item 1 (datos)**: el path de la BD no se toca (`~/.salemanteiner`), pero un `.exe` tiene que decidir si usa el mismo path o deja elegir carpeta. **Regla: el mismo path** (o los datos del usuario "desaparecen").
- **Item 5 (entorno/release)**: empaquetar es un proceso nuevo (build del instalador, firma, y en Windows el aviso de SmartScreen si no se firma). No es código de la app: es un contrato con la máquina del cliente.
- **Item 6 (sin test que lo detecte)**: el arranque (¿levanta el server? ¿abre la ventana? ¿para el server al salir? ¿sin consola?) no lo cubre ningún test: hay que verificarlo a mano y/o con un smoke script.
- **Riesgo del cliente**: si el `.exe` no está firmado, el primer clic da miedo ("Windows te protegió"). **Es la fricción #1 de S4** → decidirlo antes de la release.

## Tasks

| ID  | Spec  | Ruta                                 | Commit                   |
| --- | ----- | ------------------------------------ | ------------------------ |
| T1  | S1-S3 | esta spec: comparar y decidir        | `8ea2c98` ✅             |
| T2  | S2    | server: servir el web + fallback SPA | `2d6f7c4` ✅             |
| T3  | S2    | workspace `desktop/` + el esqueleto  | `8145b89` ✅             |
| T4  | S2    | server: empaquetado como sidecar     | `511e2e8` ✅             |
| T5  | S4    | shell Tauri: ventana, icono, ciclo   | `dfeac0b` ✅             |
| T6  | S4-S5 | instalador + firma + auto-update     | `2174987` + `d879499` ✅ |
| T7  | S4    | smoke: arranque en frío sin Node     | verificado (L11) ✅      |
| T8  | S5.4  | server: la ruta de la BD + fallback  | este commit ✅           |

**T1** es esta spec. **T2** es el habilitador (va primero y no bloquea). **T3** es el workspace `/desktop` con el CLI de Tauri (hecho). La **PWA (O1) sale de la ruta de entrega**: el cliente no puede tener un server en marcha (S3) → queda como extra opcional para desarrollo. **T4-T7** son la ruta elegida (O3).

## Log

- **L1** (2026-10-25) — El usuario pide la spec: **"ok perfecto. Ahora quiero hacer una spec para detallar y afinar como enfrontar un problema. Ese problema es como convertir esta web en un ejecutable o una aplicacion de escritorio, quiero ver ventajas y desventajas que procesos podemos hacer y que es mejor y más optimo o si es mejor dejarlo como está"**.
- **L2** (2026-10-25) — Contexto medido del repo para que la comparación no sea de opinión: `web/dist` 6,9 MB · `server/dist` 238 KB · `better-sqlite3` 27 MB (el único nativo) · deps del server ~2 MB de JS puro · WebView2 155.0.4283.62 ya instalado · Rust 1.87 y Go 1.26.1 instalados · `node:sqlite` funciona **sin flag** en Node 22.23 (puede reemplazar al nativo). El server **hoy no sirve el web compilado** → "producción" son 2 procesos, y por eso T2 es el habilitador de todo lo demás.
- **L3** (2026-10-25) — Estado de la decisión: **pendiente de S3** (¿para quién? ¿qué molestia concreta? ¿.exe o acceso directo?). La recomendación por defecto es **O0 → O1**, y **O3 (Tauri)** solo si la respuesta a la tercera pregunta es "quiero un `.exe` distribuible"; si no hay molestia concreta, la respuesta es **dejarlo como está**.
- **L4** (2026-10-25) — **El usuario responde S3**: **"es para un cliente muy torpe con la tecnologia, quiero que sea facil y tenga un icono que le de click y se ejecute solo"**. Eso **cambia la recomendación**:
  - **Descartadas como forma de entrega**: O0 y O1 (exigen Node o un server en marcha en la máquina del cliente).
  - **Elegida: O3 (Tauri 2 + sidecar de Node)** → instalador de 30-40 MB, un icono, doble clic y funciona; el backend no se reescribe.
  - **O5 (PWA con los datos en el navegador)** queda como la alternativa más suave (ni instalador) pero exige reescribir la capa de datos y mueve los datos al perfil del navegador.
  - **Nueva aceptación (S4)**: un icono, doble clic, ventana propia, sin consola, sin instalar nada más, datos en la máquina del cliente, sin errores a la vista y actualización sin `git pull`.
  - **Pendientes de S5**: cómo se entrega (instalador / ZIP / enlace / Store), si se firma el ejecutable (SmartScreen) y dónde queda la BD en la máquina del cliente.
- **L5** (2026-10-25) — **T2 implementado** (`2d6f7c4`): el server ya sirve el `web/dist` con fallback de SPA, y el contrato de la API queda intacto (`/api/*` igual, 404 JSON para lo que no existe). Verificado en el build real (`node server/dist/index.js`): `/` y `/buys` devuelven el HTML, los assets se sirven y la API sigue en JSON; **213/213** tests del server (8 nuevos) y **0 errores de consola** en el navegador. Con esto el "un solo origen" que necesita el sidecar de Tauri ya está.
- **L6** (2026-10-25) — **Las decisiones de entrega, cerradas por el usuario**:
  - **"quiero pasrale yo el ejecutable o el instalador, no quiero que abra la ms store"** → entrega **manual** de un instalador **NSIS**; **fuera la Microsoft Store**.
  - **"me gusta el auto update, vamos a usarlo. el usuario no maneja git"** → **auto-update sí o sí**: la app se actualiza sola. La firma del updater es **minisign** (`tauri signer generate`): gratis y **obligatoria** (Tauri no deja desactivar el updater); la clave **pública** va en `tauri.conf.json` y la **privada nunca se comparte**. Falta decidir **dónde se publican los instaladores** (GitHub Releases o un `/updates` propio).
  - **La BD**: ruta canónica por plataforma (`%LOCALAPPDATA%\SaleManteiner\` en Windows) con fallback al `~/.salemanteiner/data.db` de siempre → nadie pierde datos.
  - **La firma de Windows** (certificado OV, desde ~129 USD/año) queda **pendiente**: quita el "editor desconocido" pero **no** garantiza que desaparezca el aviso de SmartScreen (desde 2026 las EV tampoco dan reputación inmediata) → la vía suave sin Store es **instalar en la máquina del cliente**.
  - **Requisito bloqueante**: sin **Visual Studio Build Tools 2022** (workload C++) no hay `cl.exe` y `cargo build` falla para el target `x86_64-pc-windows-msvc`. El usuario lo está instalando.
- **L7** (2026-10-25) — **El esqueleto de `desktop/` está y compila** (`8145b89`). Decisiones de layout: el proyecto Rust vive **plano en `desktop/`** (no `desktop/src-tauri/`), y el **CLI de Tauri quedó dentro del workspace `desktop/`** (no en el root). Lo verificado: `cargo build` → `salemanteiner-desktop.exe` (con el linker de los Visual Studio Build Tools, instalados en `G:\DevTools\Visual Studio`) y `npx tauri build --debug` → el instalador **`SaleManteiner_0.1.0_x64-setup.exe`** (4,18 MiB **sin** el sidecar). Requisitos que salieron al hacerlo: **`rustup update`** (tauri 2.12 exige rustc ≥ 1.90 y había 1.87) y **ignorar `target/` y `gen/`** en el `.gitignore`/`.prettierignore` raíz (si no, `format:check` revisaba 743 archivos del build).
- **L8** (2026-10-25) — **T4 (el sidecar) armado y verificado.** El script `desktop/scripts/pack-sidecar.mjs` arma el runtime de la app en dos carpetas:
  - `desktop/binaries/salemanteiner-server-x86_64-pc-windows-msvc.exe` → **el node de la máquina renombrado** con el sufijo del target triple que Tauri exige (82,9 MiB). El shell lo lanza con el script del server como argumento.
  - `desktop/resources/server/` → el `server/dist` + sus **dependencias de runtime podadas** (85 paquetes, solo prod: express, cors, pino, pino-http, zod y better-sqlite3 con su binario nativo) = 35,8 MiB. Se instalan con un `npm install --omit=dev` en el destino, para no arrastrar el `node_modules` del root (400+ MiB).
  - `desktop/resources/web/` → el `web/dist` (6,8 MiB), que **sirve el propio sidecar** → un solo origen.
  - **Total: 125,6 MiB** de runtime (el instalador NSIS lo comprime; el objetivo de tamaño es trabajo de T6).
  - **Verificado**: el paquete arranca (`PORT` + `SALEMANTEINER_DIR` + `SALEMANTEINER_WEB_DIR`), `/` y `/buys` devuelven el HTML, `/api/health` responde JSON y los assets se sirven → el "un solo origen" funciona **con el runtime empaquetado**, no solo en el repo.
  - **Dos trampas de Windows que비용an un rato**: (1) `execFileSync('npm')` no puede lanzar el shim `.cmd` → hay que usar `npm.cmd` con `shell: true`; (2) un directorio vacío con un watcher encima no se puede borrar (`EBUSY`) → el script limpia el **contenido** y reusa el directorio en vez de `rm -rf` la raíz.
- **L9** (2026-10-25) — **T5 (el shell) armado y verificado de punta a punta.** El ciclo real del cliente ya funciona: doble clic → **la ventana abre** → el shell lanza el sidecar en un **puerto libre** → espera a que el server acepte conexiones → **navega la ventana a `http://127.0.0.1:<puerto>`** → y **al cerrar la ventana el sidecar muere** (verificado: 0 procesos huérfanos y el puerto libre). La BD del cliente quedó en `%LOCALAPPDATA%\SaleManteiner\data.db` (la ruta canónica de la decisión S5.4).
  - **Dos bugs de Windows que habrían roto la app en la máquina del cliente** (y que no se ven en el repo):
    1. **El prefijo `\\?\`**: Tauri devuelve las rutas en formato extendido de Win32 (`\\?\G:\...`) y **Node no las entiende** → resolvía el script contra el CWD y moría con `EISDIR: lstat 'G:'`. Se arregla con `dunce::simplified` (la crate que usa el propio Tauri para esto).
    2. **El CWD del sidecar**: lo hereda de la app, y una app lanzada con doble clic hereda `C:\Windows\System32` → Node tampoco puede resolver nada. Se arregla con `.current_dir(...)` explícito. Sin esto, el mismo fallo aparece en la máquina del cliente.
  - **Las rutas del shell**: los recursos se resolvieron con `app.path()` (el skill lo pide: nada de paths hardcodeados) y `dunce` los deja en formato normal para Node.
- **L10** (2026-10-26) — **T6: el instalador y la firma del updater, listos.**
  - **El instalador**: `desktop/target/release/bundle/nsis/SaleManteiner_0.1.0_x64-setup.exe` (**36,5 MiB**: el runtime empaquetado son 125,6 MiB y el instalador los comprime).
  - **La firma del updater (minisign)**: la clave **privada** quedó en `~/.salemanteiner/desktop-updater/updater.key` con su password al lado (**fuera del repo**) y la **pública** en `tauri.conf.json` (`plugins.updater.pubkey`). El build produce el `.sig` y el script `desktop/scripts/release.mjs` arma el `latest.json` que el updater consulta (el endpoint apunta a las GitHub Releases).
  - **Tres trampas que costaron tiempo** (y que se repiten si alguien rehace el paso): (1) `bundle.createUpdaterArtifacts` viene en **false** por defecto → sin eso el build no firma nada; (2) para el build la variable es `TAURI_SIGNING_PRIVATE_KEY` (**la path** es solo para `signer sign`); (3) **copiar la clave pública a mano mete un `S` por un `T`** → el build avisa que la privada no calza con la pública. Se escribe **desde el archivo**, nunca a mano.
  - **Pendiente de decisión**: la **firma de Windows** (Authenticode) sigue sin comprar (§12.6) → el instalador, al descargarse, muestra el aviso de SmartScreen. Y el instalador de NSIS va **en inglés** (es el default de Tauri): para un cliente español se puede traducir con una plantilla propia (`bundle.nsis.template`), es trabajo de T6/T7.
- **L11** (2026-10-26) — **T7 (el smoke) verde, y un hallazgo que casi nos costó caro.** Se instaló el instalador de verdad (`SaleManteiner_0.1.0_x64-setup.exe`, 36,5 MiB) y se arrancó **con el PATH sin node** → la app abre, el **node embebido** levanta el server y todo responde (200 en `/`, `/api/health` y los deep links). El web que sirve es el del bundle, no el del repo.
  - **El hallazgo**: el instalador deja la app en `%LOCALAPPDATA%\SaleManteiner\` y la carpeta de datos era **la misma** → con una instalación por máquina esa carpeta no es escribible (la app no podría crear la BD) y el desinstalador se lleva `$INSTDIR` entero. **La BD se movió a `%APPDATA%\SaleManteiner\`** (fuera de la instalación), con el mismo nombre claro. Verificado instalando y reinstalando: la app en LOCALAPPDATA, la BD en APPDATA.
  - **Lo que quedó pendente**: la **firma de Windows** (Authenticode) — sin ella el cliente ve el aviso de SmartScreen al descargar el instalador (§12.6) — y el instalador de NSIS en **inglés** (se traduce con una plantilla propia, `bundle.nsis.template`).
- **L12** (2026-10-26) — **T8: la BD la decide el server, con fallback a la legacy (la opción A que eligió el usuario).** El hueco de S5.4 (la spec dice "si la ruta nueva está vacía pero existe el `~/.salemanteiner/data.db` de siempre, se usa el viejo") estaba escrito pero **no implementado**, y la app instalada abría con la BD vacía mientras el dev veía los datos de siempre: dos bases separadas.
  - **La decisión (Opción A, del usuario)**: el `if` vive en el **server** (`server/src/config.ts` + `server/src/db/resolve-path.ts`), no en el shell → **una sola fuente de la verdad** para "dónde están los datos" y aplica a todos (dev e instalada).
  - **El orden de resolución**: `SALEMANTEINER_DB` (archivo) > `SALEMANTEINER_DIR` (carpeta) > la **ruta canónica** por plataforma (`%APPDATA%\SaleManteiner` en Windows, `~/Library/Application Support/SaleManteiner` en macOS, `$XDG_DATA_HOME/SaleManteiner` en Linux) > **y, si la canónica no tiene datos pero la legacy sí, se usa la legacy**. Los overrides explícitos mandan siempre → el e2e y el arnés visual siguen aislados (y nunca tocan la BD del usuario).
  - **El "¿tiene datos?"** es un probe **readonly** (`server/src/db/probe.ts`): si la BD no existe, tiene el esquema pero cero filas, o no se puede leer, cuenta como "sin datos" → **nadie pierde datos** y una BD corrupta no se come la buena. Verificado que un `readonly` sobre una BD **con WAL** lee bien (el caso real: la del usuario tiene el WAL de 1 MB).
  - **El shell dejó de decidir**: `desktop/src/lib.rs` ya **no** pasa `SALEMANTEINER_DIR` (que además era lo que hacía el fallback inalcanzable: con la variable puesta, el server no podía mirar la legacy). En Linux la ruta del cliente pasa de `~/.config/SaleManteiner` a `~/.local/share/SaleManteiner` (la convención XDG de datos; no hay cliente Linux todavía).
  - **El arranque lo dice**: el log del server ahora lleva `dbSource` (`canonical` | `legacy` | `explicit-file` | `explicit-dir`).
  - **Verificación**: 16 tests nuevos (`server/src/__tests__/db-path.test.ts`: la resolución con un probe falso + la resolución con el probe real sobre BDs SQLite de verdad) → **229/229 server + 275/275 web**, typecheck/lint/format limpios, `cargo check` del shell, y **verificación visual** (4 capturas revisadas a ojo: compras, dashboard, dark y móvil; 0 errores de consola) corriendo contra una **copia** de la BD real en un home falso. En la máquina, la resolución real da `legacy` → `C:\Users\titan\.salemanteiner\data.db`.
  - **La BD canónica de esta máquina** (creada por el smoke test de L11, con una compra "wdad") quedó **renombrada** a `.bak-20261026-094600` (no borrada) → así el fallback entra en juego y la app instalada ve los 32 registros de siempre.
- **L13** (2026-10-26) — **El RDD nativo volvió a estar operativo** (venía devolviendo `package-local-binary-missing` desde el 2026-10-23). La causa: la fachada busca el binario **package-local** del paquete `gentle-pi` (`<pkg>/.gentle-ai/v4.2.0/gentle-ai.exe`) y el `postinstall` del paquete nunca lo había instalado; el `gentle-ai` del PATH (`~/go/bin/gentle-ai`, v4.2.0) no cuenta. **Arreglo**: `node scripts/install-gentle-ai.mjs` dentro del paquete → en Windows compila desde el source pineado (Go + checksum de sum.golang.org) y deja el binario con su `integrity.json`. Con eso, `gentle-ai review assess` ya responde con el tier real (`nativeRisk: medium` para el commit de la BD) y el candidato real (`base-diff` con el padre del commit). Para un commit ya hecho hay que pasar `baseRef` + `committedOnly: true`: sin eso responde "the review assess candidate has no pending changes".
  - **La entrega de esta rama sigue pendiente de decisión**: la rama `feature/app-de-escritorio` acumula 44 commits y ~10.800 líneas escritas desde `master` → es un **PR** (o una cadena de PRs por work unit), no un merge directo a ciegas. El slice de este trabajo unit son 2 commits (T8 + la nota del RDD).
