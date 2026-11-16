# SECURITY.md — postura de seguridad de SaleManteiner

> Documento de referencia para usuarios, colaboradores y agentes. Describe el modelo de seguridad de la
> aplicación, los riesgos que se han **aceptado** de forma deliberada y los que están **en remediación**.
> Última actualización: 2026-11-16.

## 1. Modelo de la aplicación

SaleManteiner es una aplicación **local y de un solo usuario**:

- Un shell de escritorio (Tauri 2) arranca un **sidecar Node** que sirve la API y la web.
- El sidecar escucha **solo en loopback** (`127.0.0.1`) y en un **puerto efímero distinto en cada arranque**.
- Los datos viven en una base de datos **SQLite local** (`%APPDATA%/SaleManteiner` en Windows).
- No hay cuentas, ni telemetría, ni servicios remotos: nada sale de la máquina del usuario.

En este modelo, la **confianza implícita** es "solo loopback, solo el operador". Esa es una decisión
deliberada, no un descuido, y este documento explica qué la sostiene y qué no.

## 2. Controles que sostienen la postura

| Control                                            | Dónde                                     | Qué aporta                                                                    |
| -------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| Bind en loopback                                   | `server/src/config.ts`                    | La API no es alcanzable desde la red, solo desde la máquina.                  |
| Puerto efímero por arranque                        | `desktop/src/lib.rs`                      | El puerto **no se loguea**: un proceso o una web externa no puede adivinarlo. |
| Sin telemetría ni actualizador con red obligatoria | —                                         | Los datos del usuario no salen de la máquina.                                 |
| Validación de entrada con Zod en toda escritura    | `server/src/schemas/**`                   | Los importes se validan con `EuroMoney` (no negativos, dos decimales).        |
| Importes en euros decimales + `round2()`           | regla del repo                            | Evita el error de coma flotante en el dinero.                                 |
| La compra es transaccional con rollback            | `server/src/routes/solds.ts`              | Si el stock no cubre, la venta se rechaza con `422` y no queda nada a medias. |
| El restore valida las filas antes de importarlas   | `server/src/backup/backup-validation.ts`  | Una copia manipulada no puede introducir importes ni cantidades imposibles.   |
| Firma minisign del `.exe` released                 | `desktop/scripts/publish-new-version.mjs` | La app se actualiza verificando la firma antes de instalarse.                 |

## 3. Riesgos aceptados

Se aceptan **a conciencia**. No son bugs pendientes: son decisiones con su compensación y su
condición de re-apertura.

| Riesgo                                                 | Qué pasa                                                                                                                    | Qué lo sostiene                                                                                                              | Cuándo hay que revisarlo                                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **API local sin autenticación**                        | Cualquier proceso local puede leer y escribir la base de datos: no hay contraseña ni token.                                 | App local monousuario; bind en loopback; puerto efímero no logueado.                                                         | Si se despliega fuera de loopback, si el puerto pasa a ser fijo o se loguea, o si el equipo tiene usuarios compartidos en la misma máquina. |
| **CORS reflectivo y `Host` sin validar**               | Una página web visitada por el usuario puede alcanzar la API local (ataque de tipo DNS-rebinding).                          | Puerto efímero no logueado + protecciones de Private Network Access / Local Network Access del navegador.                    | Igual que el anterior, y si el usuario navega con un navegador que no aplique esas protecciones.                                            |
| **Restauración de la base de datos sin autenticación** | `POST /api/backups/restore` acepta un fichero SQLite y **sustituye la base de datos entera**, sin token ni confirmación.    | Decisión del propietario: app local monousuario. **La compensación es el modelo de despliegue, no un control del endpoint.** | Si el restore se expone fuera de loopback, si hay otro actor local no confiable en la máquina, o si el producto pasa a multiusuario.        |
| **Las instantáneas conservan datos ya borrados**       | Una copia de seguridad contiene clientes que el usuario ya eliminó de la base de datos viva, y no se podan automáticamente. | Decisión del propietario.                                                                                                    | Cuando se implemente una política de retención (podado de `pre-restauracion-*` y `subida-*`).                                               |

> **Consecuencia operativa**: la mitigación de los dos primeros puntos es el **puerto efímero no logueado**.
> Si alguna vez se cambia, esta hoja queda obsoleta y hay que reabrir las decisiones.

## 4. Riesgos en remediación

Detectados en la auditoría de seguridad interna (`run-1`, commit `d816a4b`) y **pendientes de corregir**.

| Hallazgo                                                                                                                    | Dónde                                     | Estado            |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------- |
| El ZIP de release que se entrega al cliente no lleva firma (el `.exe` sí)                                                   | `desktop/scripts/publish-new-version.mjs` | Planificado (W-3) |
| Las dependencias de runtime del sidecar se resuelven contra el registro en vivo, sin lockfile ni verificación de integridad | `desktop/scripts/pack-sidecar.mjs`        | Planificado (W-4) |
| El borrado en cascada de una compra deja la venta superviviente con beneficio y deuda incoherentes                          | `server/src/routes/buys.ts`               | Planificado (W-2) |
| El runtime Node embebido es una copia literal del de la máquina de build, sin versión ni checksum                           | `desktop/scripts/pack-sidecar.mjs`        | Planificado (W-5) |

El plan, con tareas, verificación y gates, está en `odd/tasks/security-remediation.md` (doc local del ODD).
El registro de qué se corrigió y en qué commit está en §6 de este mismo archivo.

## 5. Reglas para quien opera la aplicación

1. **No pongás `HOST` a mano.** La variable de entorno `HOST` mueve el bind de la API; dejala sin definir
   para que use `127.0.0.1`.
2. **No expongás el sidecar fuera de loopback** (ni por proxy, ni por reenvío de puertos, ni en una VM compartida).
3. **No abras el puerto de la API** a la red local: el bind por defecto es loopback.
4. **Verificá la firma** de las actualizaciones que descarga la propia app (la app ya lo hace por vos).
5. **Verificá también el ZIP** si lo descargás a mano: hasta que W-3 esté resuelto, no hay comprobación
   de integridad del ZIP; el `.exe` de dentro sí está firmado.
6. **Restaurar una copia es una operación irreversible** salvo por la copia de seguridad previa
   (`pre-restauracion-*`) que la propia app crea.

## 6. Registro de remediación

| Hallazgo                              | Severidad | Estado            | Corregido en |
| ------------------------------------- | --------- | ----------------- | ------------ |
| Restauración sin autenticación        | medium    | **Aceptado** (§3) | —            |
| ZIP de release sin firma              | medium    | Pendiente (W-3)   |              |
| Dependencias de runtime sin lockfile  | medium    | Pendiente (W-4)   |              |
| Invariantes de importes en el restore | low       | **Corregido**     | `0c1d148`    |
| Cascade de compras incoherente        | low       | Pendiente (W-2)   |              |
| Runtime Node sin checksum             | low       | Pendiente (W-5)   |              |

> La auditoría describe el código tal y como estaba en el commit auditado; **no se reescribe** al corregir.
> Esta tabla es la que dice desde qué commit cada hallazgo deja de ser cierto.

## 7. Cómo informar de un problema

Esta aplicación no se distribuye como servicio: no hay canal público de reporte. Si encuentras un
problema de seguridad, repórtalo al **mantenedor del repositorio** describiendo:

1. La versión de la app y el commit del repo.
2. Los pasos exactos para reproducirlo, sobre una base de datos **de prueba** (nunca la del usuario).
3. El impacto que observaste.

Mientras tanto, aplica las reglas de §5: la mayoría de los riesgos de esta tabla se cierran manteniendo
la API en loopback con puerto efímero.

## 8. Trazabilidad

| Qué                                                                 | Dónde                                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Auditoría interna `run-1` (artefactos, informe, ledger, decisiones) | Fuera del repo: `C:/Users/titan/security-audit-skill/SaleManteiner/run-1/` |
| Registro de decisiones del propietario (D-01…D-09)                  | `DECISIONS.md` en el mismo directorio                                      |
| Plan de remediación por tareas                                      | `odd/tasks/security-remediation.md` (local, no versionado)                 |
| Límites de ejecución de la auditoría                                | `RESUME.md` §8 (mismo directorio)                                          |
