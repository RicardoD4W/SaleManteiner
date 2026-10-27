# Changelog

> Los cambios de cada versión de SaleManteiner. El formato es el de
> [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado
> es [SemVer](https://semver.org/lang/es/).
>
> La versión de la app vive en `desktop/tauri.conf.json`; la del front, en
> `web/package.json`; la del back, en `server/package.json`. El script
> `scripts/write-versions.mjs` las lee y las publica en `web/.env` y
> `server/version.json` → la app las muestra en el pie y `GET /api/version` las
> devuelve.

## [Sin publicar]

### Cambiado

- **El concepto del producto se amplía**: SaleManteiner deja de ser "el tracker de Wallapop para revendedores" y pasa a ser el **gestor de compras, ventas y clientes** para cualquier tipo de usuario (README, PRODUCT, AGENTS, metadatos y copy de la app). El nombre, el modelo de datos y el comportamiento no cambian.

### Corregido

- **El auto-update fallaba a mitad de la instalación**: el updater de Windows cierra la app pero dejaba vivo el **sidecar** (el proceso Node), que tenía abierto el addon nativo de `better-sqlite3`. El instalador no podía escribirlo ("Error abriendo archivo para escritura") y la actualización se caía. Ahora el sidecar se cierra **después de descargar y antes de instalar** (`desktop/src/lib.rs`). Verificado de punta a punta: la app instalada 0.1.0 detectó la 0.1.1, preguntó con el diálogo nativo, descargó, instaló y se reinició en 0.1.1.

## [0.1.1]

**Publicada el 2026-10-26**

### Añadido

- **El instalador en español**: Tauri 2.12 ya trae la traducción de NSIS, así que el bundle declara `bundle.windows.nsis.languages = ["Spanish"]` y deja los textos que usa en `desktop/nsis/Spanish.nsh` (customizable). Antes salía en inglés.
- **Un `.zip` con el instalador** para el cliente: el _Mark of the Web_ (la marca que Windows pone a los archivos descargados) es lo que dispara el aviso "Windows te protegió tu PC", y un archivo dentro de un zip no la lleva → el cliente descomprime y ejecuta **sin avisos** y sin necesidad de un certificado de firma de Windows. `npm run publish:new-version` lo sube a la release.
- **El sistema de versiones visible**: una fuente por artifact (`desktop/tauri.conf.json`, `web/package.json`, `server/package.json`) → `scripts/write-versions.mjs` genera `web/.env` y `server/version.json`, el server expone `GET /api/version` y el pie de la app muestra app, front y back.
- `.gitleaks.toml`: el escáner ya no reporta los artefactos de build de Rust ni la clave pública del updater (que es pública por diseño).

### Corregido

- `release.mjs` y `write-versions.mjs` leen sus JSON dentro de un `try/catch`: un archivo faltante o malformado ahora dice qué falló y dónde, en vez de reventar con un stack.
- La ruta de la **base de datos** la decide el server (canónica por plataforma y fallback a la legacy si la nueva está vacía) y el shell de Tauri dejó de pasar `SALEMANTEINER_DIR`: la app instalada y el dev ven los mismos datos.

## [0.1.0]

**Publicada el 2026-10-25**

### Añadido

- **La app de escritorio** (Tauri 2 + el server como _sidecar_): el web compilado y el server viajan dentro del instalador; la app **arranca sola** (el cliente no instala Node ni abre una terminal) y **se actualiza sola**.
- **Un solo origen**: el server sirve el `web/dist` con fallback de SPA → el web y la API viven en el mismo origen. El contrato de la API no cambia.
- **Auto-update con minisign** (gratis y obligatorio: Tauri no instala un artefacto sin firma). La clave privada nunca se commitea; la pública va en `tauri.conf.json`.
- `npm run build:app`: compila el front, compila el back, re-empaqueta el sidecar y genera el instalador, en un comando.
- `npm run publish:new-version`: mira qué versión está distribuida y publica **solo si la local difiere** (comparación semver: la misma no hace nada y un downgrade se niega).

### Base del producto (ya en `master` desde antes)

- El gestor de **compras, ventas y clientes** con packs multi-producto, stock por unidad y validación transaccional (422 con el detalle de qué falta).
- El **dashboard**: 4 KPIs, flujo de caja de los últimos 12 meses, top 5 de productos y de compradores, en 4 pestañas ordenables.
- **Búsqueda que entiende**: texto, precios, cantidades (`x3`), fechas (`12/03/2025`) y pérdidas (`-30`), combinables.
- **100% local**: sin cuentas, sin nube, sin telemetría y sin peticiones a terceros.

[Sin publicar]: https://github.com/RicardoD4W/SaleManteiner/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/RicardoD4W/SaleManteiner/releases/tag/v0.1.1
[0.1.0]: https://github.com/RicardoD4W/SaleManteiner/releases/tag/v0.1.0
