# Estado — SaleManteiner

> Dónde está el proyecto, qué falta y qué pasó. Es el doc que se actualiza en cada entrega.
> Contexto: [AGENTS.md](AGENTS.md) · Producto: [PRODUCT.md](PRODUCT.md) · Escritorio: [DESKTOP.md](DESKTOP.md).

## 1. Estado actual

- **Rama de trabajo**: `feature/app-de-escritorio` (todo pusheado a `origin`). `master` y `feature/componentizar-y-optimizar` también están pusheadas.
- **Modelo de datos activo**: `buys + solds + sale_items + customers` (migración 003; las vistas 004/005 encima).
- **App**: cuatro vistas (Dashboard · Compras · Ventas · Clientes), borrado desde las tablas con doble confirmación cuando hay ventas asociadas.
- **Escritorio**: Tauri 2 + sidecar, instalador NSIS, auto-update con minisign implementado. Falta la entrega (instalador firmado + prueba de punta a punta).
- **Verificación del último trabajo**: 238/238 tests del server, 277/277 del web, typecheck/lint/format limpios, capturas revisadas a ojo con 0 errores de consola.

## 2. Pendientes (requieren una decisión o una acción del usuario)

| #   | Pendiente                                                                                                                | Qué hace falta                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | ~~**Rehacer el instalador firmado**~~ → **hecho**: 0.1.0 y 0.1.1 firmados con minisign y en español                      | —                                                                                                                                                            |
| 2   | ~~**Probar el auto-update de punta a punta**~~ → **hecho** (2026-10-26)                                                  | La app instalada 0.1.0 detectó la 0.1.1, preguntó con el diálogo nativo, descargó los 38 MB, cerró el sidecar, instaló y se reinició en 0.1.1                |
| 3   | **Entrega de la rama `feature/app-de-escritorio`**: 50+ commits y ~11.500 líneas desde `master`                          | **Hecho**: mergeada a `master` y pusheada (2026-10-26)                                                                                                       |
| 4   | **`feature/componentizar-y-optimizar`**: decidir si se mergea a `master`                                                 | **Hecho**: entró a `master` por la vía de la del escritorio                                                                                                  |
| 5   | **Paginación en el server** (`odd/tasks/feature-paginacion.md`)                                                          | Primero el fix de la vista de cifras (S2 del spec): `v_sold_costs` materializa el COGS de todo el historial antes de filtrar                                 |
| 6   | **Bug visual**: en móvil (390px) la leyenda del chart del dashboard envuelve a 2 líneas y **pisa la etiqueta del eje Y** | `<Legend height={36}>` en `web/src/components/dashboard/CashFlowChart.tsx`: reservar más alto o achicar la fuente en móvil                                   |
| 7   | **Reportar upstream el defecto de la fachada del RDD**                                                                   | Evidencia en `odd/tasks/feature-app-de-escritorio.md` (L13/L14)                                                                                              |
| 8   | **Firma de Windows (Authenticode)**: **decidida: no comprarla por ahora** (2026-10-26)                                   | Con el ZIP el cliente no ve el aviso de SmartScreen; si lo ve, la vía suave es instalar en la máquina del cliente. Soporte ya documentado en `DESKTOP.md` §5 |
| 9   | ~~**Traducir el instalador al español**~~ → **hecho** (`bundle.windows.nsis.languages = ["Spanish"]`)                    | —                                                                                                                                                            |
| 10  | **Probar la app en una máquina sin Node** (el smoke en frío de verdad, en la del cliente)                                | Instalar el `.zip` en la máquina del cliente: que abra, guarde datos y se actualice sola                                                                     |

### Decisiones ya tomadas (no son deuda)

- **El borrado en cascada no tiene undo**: audit trail en el log del server + aviso "Esta acción no se puede deshacer" en la UI. Riesgo asumido explícitamente por el usuario.
- **La vuelta desde el formulario por el logo del header no arma la fila**: la id del registro no puede viajar en el `state` de esa navegación → esa vuelta degrada a cross-fade. Solo afecta a la view transition, no a la funcionalidad.

## 3. Herramientas: la revisión nativa (RDD)

**Estado**: parcialmente operativa.

- **Arreglo del 2026-10-26**: la fachada busca el binario **package-local** (`<gentle-pi>/.gentle-ai/v4.2.0/gentle-ai.exe`), que el `postinstall` del paquete nunca había instalado (el `gentle-ai` del PATH **no** cuenta). Arreglo: `cd <gentle-pi> && node scripts/install-gentle-ai.mjs` → en Windows compila el source pineado (v4.2.0, con checksum de sum.golang.org) y deja el binario con su `integrity.json`. Si vuelve a faltar, ese mismo comando, o registrar el build propio en `~/.pi/gentle-ai/dev-binary.json` (`{"schema":"gentle-pi.dev-binary/v1","path":"<ruta absoluta>"}`).
- **Lo que ya funciona** (verificado sobre el commit `574a1e1`): `assess` (`nativeRisk: medium`, candidato `base-diff`), `inspect`, `start` (crea el lineage y materializa los 3 revisores: risk, resilience, reliability) y el **forecast** del group capture (3 model runs, transporte `pi_host_relay`).
- **El hueco que queda**: la captura **autorizada** (`reviewerRunAcknowledged: true`) la rechaza la fachada con _"collectBindings must be the complete distinct current reviewer group in exact provider order"_ (group) y _"collectBinding is missing or stale for current STATUS"_ (slot suelto) — **aunque los bindings enviados son byte a byte los del provider**: se verificó canonicalizando el input crudo del `gentle-ai review status` con el normalizador del propio paquete (`decodeReviewStatusV3`) y comparando con la proyección del STATUS (idéntico). Los tres status (con `base-ref`, sin `base-ref` y mínimo) dan el mismo grupo. Queda como **defecto de la fachada** (la proyección `collectBindings` filtra el input `external.select_intended_untracked` que la validación de grupo sí exige).
- **Nota**: un `assess` sin cambios pendientes responde "the review assess candidate has no pending changes" → hay que pasarle `baseRef` (el padre del commit) con `committedOnly: true`.
- **Mientras tanto**, la cobertura de un cambio es: gates + **verificador independiente** (solo lectura) sobre las unidades de riesgo.

## 4. Otras notas de la casa

- **La suite del web va 3× más rápido**: `web/vitest.config.ts` usa `pool: 'vmThreads'` (el jsdom se crea una vez por worker) + `maxWorkers: 5`. Medido: 25,86 s → 8,62 s. `isolate: false` quedó **descartado**: filtra los `vi.mock` entre archivos (el web los usa 127 veces en 19 archivos) y rompe `src/lib/__tests__/toast.test.ts` según el orden. Para volver a medir: `npx vitest doctor` dentro de `web/`. El **server no necesita nada**: su entorno es `node` (sin DOM).
- **El test de `totals12m` fijaba un beneficio de 19,5** (número calculado a mano que nunca se ejecutó, commit `b47f2e7`): el correcto es **25** — lo confirman el KPI, `totals12m` y el mes con la misma fixture.
- **`openDb` crea el directorio padre** de la BD si no existe (`mkdirSync({ recursive: true })`).

## 5. Historial (hitos)

| Fecha      | Hito                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-16 | Monorepo `web/` + `server/` andamiaje; el MVP pivota a **entrada manual** (el scraping se retira).                                                                                                                                                                                           |
| 2026-10-19 | Cierre de Fase 8 (e2e + README + AGENTS). Borrado de compras en cascada con 409 + audit trail.                                                                                                                                                                                               |
| 2026-10-21 | Tanda de pulido de UI (cursor, view transition con todos los campos, link del header, orden del picker). Borrado desde las tablas y vista de Clientes.                                                                                                 |
| 2026-10-22 | El dato que viaja al formulario deja de parpadear; el relevo es un cross-fade dentro del overlay; bug del picker en la venta nueva.                                                                                                                                                          |
| 2026-10-23 | Refactor de limpieza + **auditoría de calidad** (11 puntos) mergeados a `master`: una fuente de la verdad (vistas SQL, schemas compartidos), `<Modal>` único, orden con una sola regla, y el bug de la validación del cliente que nunca se veía (`noValidate`).                              |
| 2026-10-25 | **App de escritorio**: Tauri 2 + sidecar, instalador NSIS, auto-update con minisign. Suite del web 3× más rápida.                                                                                                                                                                            |
| 2026-10-26 | **La ruta de la BD la decide el server** (canónica por plataforma + fallback a la legacy); RDD nativo arreglado (binario package-local); `build:app`, `publish:new-version` y el **sistema de versiones** (footer con app/front/back).                                                       |
| 2026-10-27 | **Concepto del producto ampliado**: SaleManteiner deja de ser "el tracker de Wallapop para revendedores" y pasa a ser el **gestor de compras, ventas y clientes** para cualquier tipo de usuario. Copy de docs, metadatos y header actualizados; sin cambios de modelo ni de comportamiento. |

El detalle de cada hito está en el Log del feature doc correspondiente (`odd/tasks/`, local y no versionado), y el de la última sesión en `odd/HANDOFF.md`.
