# Happy path de SaleManteiner

Checklist de **todo lo que puede hacer un usuario** en un flujo normal: crear un cliente, modificarlo, hacer una compra, venderla, borrarla… Es el guion de humo que hay que recorrer **mirando la web** (skill `visual-verification`, AGENTS.md §8.1) para comprobar que un refactor no rompió nada.

- **Cómo se verifica**: el arnés de capturas **no vive en el repo** (se arma en el directorio temporal cuando hace falta, §8.1): un script levanta su propio backend (`PORT=<libre> SALEMANTEINER_DIR=<tmp>`) y su propio Vite (`--port <libre>` con `API_TARGET`), siembra datos por la API y captura con el Chromium del repo. **La BD es temporal: nunca toca `~/.salemanteiner`.**
- **Cómo se marca**: cada punto se marca solo si se **miró** la captura (un test verde no prueba que "se ve bien").
- **Última corrida**: 2026-10-23, después del refactor de limpieza (`refactor/limpieza-y-ingles`) → **15/15 pasos del guion, 28 capturas revisadas, 0 errores de consola**.

---

## 1. Global

| #   | Qué hace el usuario                        | Verificar                                                                     | Resultado |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------- | --------- |
| 1.1 | Abre la app y ve el dashboard por defecto  | `/` carga los 4 KPIs + el chart + las 2 tablas                                | ✅        |
| 1.2 | Navega entre las 4 vistas del header       | Dashboard · Compras · Ventas · Clientes                                       | ✅        |
| 1.3 | Cambia a dark mode y recarga               | el toggle del header, la clase `dark` en `<html>` y persiste (`localStorage`) | ✅        |
| 1.4 | Vuelve atrás desde un formulario           | la fila queda "armada" (se puede volver a abrir)                              | ✅        |
| 1.5 | Ve el dato viajar de la fila al formulario | transición de elemento compartido: el valor sale de la celda y llega al input | ✅        |

## 2. Dashboard

| #   | Qué hace el usuario                              | Verificar                                                                              | Resultado |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------- | --------- |
| 2.1 | Mira el resumen                                  | KPIs: Compras totales, Ventas totales, Beneficio, Stock pendiente                      | ✅        |
| 2.2 | Mira el flujo de caja                            | chart de los últimos 12 meses con las 3 series (Beneficio, Compras, Resultado del mes) | ✅        |
| 2.3 | Mira los top 5 productos y los top 5 compradores | las dos tablas del resumen                                                             | ✅        |
| 2.4 | Abre la tab **Ingresos**                         | totales de los últimos 12 meses + Beneficio + Mejor mes + el chart                     | ✅        |
| 2.5 | Abre la tab **Productos**                        | top 5 con revenue y beneficio, ordenable                                               | ✅        |
| 2.6 | Abre la tab **Compradores**                      | top 5 con ventas y total gastado, ordenable                                            | ✅        |

## 3. Compras

| #   | Qué hace el usuario             | Verificar                                                                         | Resultado |
| --- | ------------------------------- | --------------------------------------------------------------------------------- | --------- |
| 3.1 | Ve la lista de compras          | Producto, Coste, Cantidad, Asociados, Fecha, **Disponibles** y las acciones       | ✅        |
| 3.2 | Busca o filtra                  | por producto, coste, cantidad, fecha y disponibles                                | ✅        |
| 3.3 | Ordena por una columna          | clic en la cabecera: asc → desc → sin orden (con `aria-sort`)                     | ✅        |
| 3.4 | **Crea una compra**             | "+ Nueva compra": producto, coste, cantidad, costes asociados y fecha             | ✅        |
| 3.5 | Edita una compra                | producto, coste, cantidad, asociados y fecha; el stock se recalcula               | ✅        |
| 3.6 | Ve el aviso de stock bajo       | "Disponibles" en ámbar cuando quedan 2 o menos                                    | ✅        |
| 3.7 | Borra una compra **sin** ventas | confirmación y la fila desaparece                                                 | ✅        |
| 3.8 | Borra una compra **con** ventas | 409 → modal "La compra tiene ventas asociadas" → borra la compra **y** sus ventas | ✅        |

## 4. Ventas

| #   | Qué hace el usuario                        | Verificar                                                                                         | Resultado |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------- |
| 4.1 | Ve la lista de ventas                      | Fecha, Cliente, Productos, Precio, Asociados, **Beneficio**, Registrado                           | ✅        |
| 4.2 | Busca o filtra                             | por cliente, producto, precio, beneficio y fecha                                                  | ✅        |
| 4.3 | Ordena por una columna                     | asc → desc → sin orden                                                                            | ✅        |
| 4.4 | **Crea una venta**: elige productos        | "+ Nueva venta" abre primero el **picker**: marca, cantidad y "disponibles" por producto          | ✅        |
| 4.5 | Confirma los productos y completa la venta | precio, gastos asociados, fecha (default hoy), notas y **cliente** (hay que elegirlo de la lista) | ✅        |
| 4.6 | Crea un cliente desde el autocomplete      | el mismo autocomplete permite dar de alta un cliente que no existe                                | ✅        |
| 4.7 | Edita una venta                            | precio, cliente, fecha y notas (los productos no se editan)                                       | ✅        |
| 4.8 | Borra una venta                            | confirmación y **se libera el stock** (los "Disponibles" de la compra suben)                      | ✅        |
| 4.9 | Intenta vender más stock del que hay       | el server responde 422 "Stock insuficiente" y la modal lo muestra                                 | ✅        |

## 5. Clientes

| #   | Qué hace el usuario             | Verificar                                                                     | Resultado |
| --- | ------------------------------- | ----------------------------------------------------------------------------- | --------- |
| 5.1 | Ve la lista de clientes         | nombre + acciones de editar y borrar                                          | ✅        |
| 5.2 | Busca o filtra                  | por nombre                                                                    | ✅        |
| 5.3 | Ordena por una columna          | asc → desc → sin orden                                                        | ✅        |
| 5.4 | **Crea un cliente**             | "+ Nuevo cliente": nombre y guardar                                           | ✅        |
| 5.5 | Edita un cliente                | el modal con el nombre actual → guardar                                       | ✅        |
| 5.6 | Borra un cliente **sin** ventas | confirmación y desaparece                                                     | ✅        |
| 5.7 | Borra un cliente **con** ventas | 409 → modal "Borrar también las ventas y el cliente" → borra cliente + ventas | ✅        |

---

## Comportamientos conocidos (NO son bugs)

- **En móvil (390px) el header se scrollea**: el toggle de tema queda fuera de la vista y se llega scrolleando (`overflow-x-auto`).
- **El toast tapa la columna de acciones** unos segundos: si vas a hacer clic en "Editar" justo después de guardar, espera a que desaparezca.
- **En el autocomplete de clientes hay que elegir de la lista**: escribir el nombre no basta (el campo `customer_id` se setea al elegir); si no se elige, el form dice "El cliente es obligatorio".
- **Los productos de una venta no se editan**: se borra la venta y se vuelve a crear.

## Bugs que encontró este guion (y cómo se corrigieron)

| Cuándo     | Qué pasó                                                                                                                                                                                                                                                                                                                                                                   | Corrección                                                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-23 | Al **guardar una venta**, la respuesta del `PATCH` (que no trae los items) entraba en la caché del detalle: la página de edición se re-renderizaba con una venta sin items y reventaba con `Cannot read properties of undefined (reading 'length')`. Era **intermitente** (dependía de si React llegaba a pintar el re-render antes de navegar) y **los e2e no lo veían**. | `useUpdateSold` ahora **fusiona** la respuesta con la entrada previa de la caché (`old ? { ...old, ...data } : old`) en vez de pisarla: el detalle de la venta conserva los items. Verificado con 3 corridas seguidas del guion completo (15/15) y 0 errores de consola. |
| 2026-10-23 | React se quejaba de **claves duplicadas** en la lista de productos del dashboard: la clave era el _nombre_ del producto (dos compras con el mismo nombre = dos filas con la misma clave).                                                                                                                                                                                  | El payload de `topProducts` ahora incluye `product_id` y la clave es ese id.                                                                                                                                                                                             |

## Cómo repetir el recorrido

1. Crear el arnés **fuera del repo** (un `.mjs` en el temporal) que: levanta el backend con `PORT` y `SALEMANTEINER_DIR` temporales, levanta el Vite con `API_TARGET`, y recorre los 15 pasos de arriba **por la UI** (no por la API): crear → editar → vender → filtrar → ordenar → borrar en cascada → dark → móvil.
2. Cada paso: una captura (`fullPage`) + un assert de que la pantalla cambió como debía.
3. **Mirar** las capturas con la herramienta `read` (esto es lo que atrapa lo que ningún test ve).
4. Registrar los errores de consola: un error de runtime no se ve en una captura, pero sí lo detecta ese paso.
