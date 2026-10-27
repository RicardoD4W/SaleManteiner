# SaleManteiner

**El gestor de compras, ventas y clientes.** Lleva el control de stock, las cifras del negocio y el beneficio real de cada venta, en tu propio computer.

> **100% privado.** Todo vive en tu máquina: ni cuentas, ni nube, ni telemetría, ni un solo byte fuera de tu disco. Funciona igual en la versión web y en la app de escritorio.

![Estado](https://img.shields.io/badge/estado-operativo-2ea44f) ![Plataforma](https://img.shields.io/badge/plataforma-Windows%20%7C%20macOS%20%7C%20Linux-informational)

---

## Qué es

Comprás, vendés y querés saber cómo van tus números. SaleManteiner es el cuaderno digital de tus compras, ventas y clientes:

- Cargas **cada compra** con su coste, cantidad y gastos de envío.
- Cargas **cada venta** con su precio, gastos, comprador y qué productos se vendieron.
- La app **calcula el beneficio real** de cada venta (precio − gastos − lo que te costó el producto) y te dice cuánto dinero dejaste de ganar o de perder.
- El **stock se descuenta solo**: no podés vender lo que no compraste, y la app te avisa si no reaches a cubrir una venta.

Nada de scraping, nada de captura automática, nada de conectar cuentas de terceros, nada de subir tus datos a ningún lado: vos cargás los datos a mano y la app solo te ayuda a no equivocarte.

## Qué podés hacer

### 🛒 Compras — tu stock, con su coste real

| Campo           | Qué es                                                   |
| --------------- | -------------------------------------------------------- |
| Producto        | el nombre del artículo                                   |
| Coste           | lo que pagaste **en total** por ese lote                 |
| Cantidad        | cuántas unidades compraste                               |
| Asociados       | gastos de envío, embalaje, comisiones (totales del lote) |
| Fecha de compra | editable (por defecto, hoy)                              |

La tabla te muestra, además, **cuántas unidades te quedan disponibles** de cada compra. Editás y borrás desde la propia tabla.

### 🧾 Ventas — packs, compradores y beneficio

| Campo           | Qué es                                                  |
| --------------- | ------------------------------------------------------- |
| Cliente         | obligatorio, con creación en línea si no existe         |
| Precio de venta | el total cobrado por la venta                           |
| Asociados       | gastos de envío o comisión de esa venta                 |
| Fecha de venta  | editable (por defecto, hoy)                             |
| Notas           | texto libre                                             |
| Productos       | qué compras se vendieron y cuántas unidades de cada una |

Una venta puede ser un **pack de varios productos** (cada uno de una compra distinta). Al guardar, la app comprueba que haya stock: si no alcanza, te dice exactamente **qué producto falta y cuánto**.

### 👥 Clientes — quién te compra y cuánto deja

Alta, edición y borrado de clientes, con el **número de ventas** y el **total gastado** de cada uno. Si borrás un cliente con ventas, la app te pide confirmación y te dice a qué ventas afecta.

### 📊 Dashboard — las cifras que importan

- **4 KPIs**: compras totales, ventas totales, **beneficio** (verde si ganaste, rojo si perdiste) y stock pendiente.
- **Gráfico de flujo de caja** de los últimos 12 meses: beneficio, compras y resultado del mes.
- **Top 5 productos** y **Top 5 compradores**, con lo que generó cada uno.
- Cuatro pestañas: **Resumen**, **Ingresos**, **Productos** y **Compradores**, cada una ordenable.

### 🔎 Filtros y búsqueda que entiende de verdad

Un solo campo de búsqueda en las tablas de compras y ventas, y no es una búsqueda tonta:

| Escribís                    | Te busca                            |
| --------------------------- | ----------------------------------- |
| `ipad`                      | por nombre de producto o de cliente |
| `25`                        | por precio, coste o cantidad        |
| `x3`                        | filas con 3 unidades                |
| `12/03/2025` o `2025-03-12` | por fecha de compra o de venta      |
| `-30`                       | ventas con **pérdida** de 30 €      |

Se pueden **combinar** (varias palabras = todas las condiciones). Y **todas las tablas se ordenan** haciendo clic (o con el teclado) en la cabecera.

### 🧩 Detalles que se notan

- **Modo oscuro** (sol/luna) que recuerda tu preferencia, sin parpadeo al cargar.
- **Responsive**: se usa bien en el móvil (390px), con tablas virtualizadas para que no se trabe.
- **Atajos de teclado** y foco bien gestionado en los modales (se cierran con `Escape`).
- **Avisos claros** cuando algo no cuadra (validación, stock insuficiente, borrado en cascada).
- **UI en español**, fechas en `dd/MM/yyyy` y euros con el formato español.

---

## Privacidad

Esto es lo más importante de la app, y es una decisión de diseño, no una promesa de marketing:

- 🔒 **Todo es local.** Tus compras, ventas y clientes viven en **un único archivo SQLite** en tu disco.
- 🚫 **Sin cuentas ni login.** No hay registro, ni contraseñas, ni servidor remoto.
- 🚫 **Sin telemetría ni analítica.** La app no reporta nada: no hay crack de reporting, ni envío de datos, ni "mejorar la experiencia".
- 🚫 **Sin peticiones a terceros.** Ni analytics, ni CDN de fuentes, ni beacons: la app funciona con la red apagada.
- 🌐 **En la versión web**, el servidor corre en tu propio computer (`localhost:4000`): no es un servicio en la nube.
- 💾 **Los datos no se tocan al actualizar** la app de escritorio: la base de datos vive fuera de la carpeta de instalación.

Dónde vive la base de datos:

| Sistema | Ruta                                                  |
| ------- | ----------------------------------------------------- |
| Windows | `%APPDATA%\SaleManteiner\data.db`                     |
| macOS   | `~/Library/Application Support/SaleManteiner/data.db` |
| Linux   | `$XDG_DATA_HOME/SaleManteiner/data.db`                |

Si esa carpeta está vacía pero tenés una base vieja en `~/.salemanteiner/data.db`, la app la usa: **nadie pierde datos**.

**Copia de seguridad**: es un archivo. Copialo cuando quieras (con la app cerrada, o con `sqlite3 data.db ".backup copia.db"`).

---

## Instalación

### Versión de escritorio (la recomendada)

Instalador para Windows, macOS y Linux. **No necesitás instalar Node ni abrir una terminal**: doble clic en el ícono y la app arranca.

1. Bajá el **`.zip`** de la [release](https://github.com/RicardoD4W/SaleManteiner/releases) y descomprimilo.
2. Dentro está el instalador: doble clic y seguí los pasos (todo en español).
3. Abrí la app desde el ícono: **no necesitás instalar Node ni abrir una terminal**.
4. Listo: la app **se actualiza sola** (no tenés que saber qué versión tenés).

> **Por qué el `.zip` y no el `.exe`**: Windows marca los archivos descargados y eso dispara el aviso "Windows te protegió tu PC". Un archivo dentro de un zip no lleva esa marca → el cliente descomprime y ejecuta, sin avisos. Si aun así lo viera, es **Más información → Ejecutar** (o, mejor, que le pases el archivo a mano y lo instales en su máquina).

### Versión web (para desarrollo)

Necesitás **Node.js 22 LTS** (recomendado: [fnm](https://github.com/Schniz/fnm)).

```bash
git clone https://github.com/RicardoD4W/SaleManteiner.git
cd SaleManteiner
npm install
npm run dev
```

- App → <http://localhost:5173>
- API → <http://localhost:4000/api/health>

---

## Documentación

| Doc                                | Qué hay                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitectura general: stack, modelo de datos, reglas de código, API       |
| [WEB.md](WEB.md)                   | Detalle técnico del frontend (React, estado, componentes, estilos, tests) |
| [SERVER.md](SERVER.md)             | Detalle técnico del backend (Express, rutas, repos, migraciones, errores) |
| [DESKTOP.md](DESKTOP.md)           | La app de escritorio: sidecar, instalador, auto-update, versiones         |
| [WORKFLOW.md](WORKFLOW.md)         | Cómo se trabaja en el repo: gates, skills                                 |
| [PRODUCT.md](PRODUCT.md)           | Decisiones de producto y roadmap                                          |
| [CHANGELOG.md](CHANGELOG.md)       | Qué cambió en cada versión                                                |

---

## Tecnología

React 19 · TypeScript · Vite 8 · Tailwind 4 · TanStack Query · TanStack Table · Recharts · Node 22 · Express 5 · SQLite (better-sqlite3) · Zod · Pino · Vitest · Playwright · Tauri 2 (escritorio)

---

## Desarrollo

```bash
npm run dev            # server + web
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm run format:check   # Prettier (gate)
npm run test           # Vitest: server + web
npm run test:e2e       # Playwright
npm run build:desktop  # instalador de escritorio (front + back + sidecar)
```

Las reglas del repo y dónde están las trampas: [WORKFLOW.md](WORKFLOW.md).

## Limitaciones conocidas

- Gestión **manual**: no hay captura automática ni importación/exportación CSV.
- El **borrado en cascada no se puede deshacer** (deja rastro en el log del servidor).
- La versión de escritorio se distribuye **a mano** (no está en la Microsoft Store ni en el Homebrew de forma automática).
- La **firma de Windows** (Authenticode) está pendiente: sin ella aparece el aviso del editor desconocido.
