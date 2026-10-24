# Feature: paginación en el server (y la vista de las cifras)

> Nasce de la auditoría de calidad (2026-10-23) y de la decisión del usuario al cerrar el feature `componentizar-y-optimizar`: **"reglas del ordenamiento ahora + paginación aparte"**, y **"la vista se deja y se espera a la paginación"**.

El problema que resuelve: **la API devuelve toda la historia**. A 50 ventas/mes, 8 años son 4.800 ventas ≈ **1,35 MB** de JSON que el navegador baja, parsea, tiene en memoria, filtra y ordena en cada tecla. La tabla ya está virtualizada (el DOM es chico), pero **los datos siguen todos en el cliente**.

## Specs

### S1 — El server manda la página

> "que escale mejor y sea más optimo"

- `GET /api/buys` y `GET /api/solds` aceptan **paginación** (`?page=` / `?limit=`, con un tope) y devuelven **una página** + el total de filas (para el "N compras" del pie y el contador del buscador).
- El **orden** lo decide el server (`?sort=producto&dir=asc`), no el cliente: el SQL ordena con el índice y el cliente pinta lo que le llega.
- El **filtro de texto** también puede ir al server (hoy `filterBuys`/`filterSolds` filtran en memoria). **Depende del tamaño**: con `limit` la respuesta ya es chica, pero filtrar 4.800 filas en el cliente por cada tecla sigue siendo trabajo innecesario.
- La tabla virtualizada sigue igual: **virtualiza la página**, no el histórico.

### S2 — La vista de las cifras tiene que dejar de escalar con el historial (SÍ O SÍ)

> "el listado con filtro de cliente va de 0,29 ms a 11 ms"

Hoy `v_sold_costs` agrupa por venta → SQLite la **materializa** (calcula el COGS de **todas** las ventas) y después filtra:

```sql
MATERIALIZE ic → SCAN si → BLOOM FILTER ON ic → SEARCH ic
```

Medido con las consultas reales del repo y 4.800 ventas:

| Consulta                                | Vista actual (GROUP BY) | Con subconsultas correlacionadas |
| --------------------------------------- | ----------------------- | -------------------------------- |
| lista de ventas, **filtro por cliente** | 9,3 ms                  | **0,8 ms** (11x)                 |
| lista de ventas, sin filtro             | 13,1 ms                 | 15,1 ms (+15%)                   |
| dashboard: total de beneficio           | 11,0 ms                 | 13,4 ms (+21%)                   |
| dashboard: beneficio por mes            | 15,1 ms                 | 16,3 ms (+8%)                    |
| dashboard: top productos                | 10,8 ms                 | 10,6 ms (igual)                  |

A la escala real (600 ventas = 1 año) todo está entre 0,1 y 2,1 ms → invisible. Lo que importa es **el diseño**: la vista actual escala con el **historial** (a 20.000 ventas, el filtro por cliente ya paga 45 ms) y la de subconsultas escala con **lo que devuelve**.

**=> Sin este fix, la paginación es una trampa**: cada página que se pida pagaría el costo de todo el historial (la vista materializa antes de filtrar). **El fix de la vista y la paginación van juntos.**

La alternativa "óptima" (una tabla materializada con triggers en `solds`/`sale_items`/`buys`) deja el dashboard en O(1), pero mete una caché que hay que mantener con triggers: un trigger mal escrito = números mal. A 50 ventas/mes no aporta nada → **descartada por ahora**.

### S3 — Lo que NO cambia

- Las **cifras**: la fórmula del beneficio sigue viviendo en la vista SQL (una sola fuente) y los números no se mueven (está pineado en `server/src/__tests__/vistas-cifras.test.ts`).
- El **orden** de las tablas: la regla es la de `web/src/lib/sorting.ts` (nulos primero, números como números, textos en español) → si el orden pasa al server, el server ordena con la misma regla (`COLLATE NOCASE` para los textos).
- La **vista virtualizada** y el resto de la UI.

## Riesgos

- **Item 3** (contratos que otros consumen): cambia el contrato de `GET /api/buys` y `GET /api/solds` (paginación y orden) → hay que actualizar el cliente en el mismo commit y pinear el contrato con tests de rutas.
- La **vista**: es el área más delicada (las cifras) → la migración nueva tiene que ir con el test que prueba que las cifras no cambian.

## Tasks

| ID  | Spec  | Ruta                                                            | Commit    |
| --- | ----- | --------------------------------------------------------------- | --------- |
| T1  | S2    | server: migración con la vista de subconsultas + test de cifras | pendiente |
| T2  | S1    | server: paginación + orden en la API (contrato + tests)         | pendiente |
| T3  | S1    | web: el cliente pide la página y manda el orden                 | pendiente |
| T4  | S1-S3 | gates + verificación visual                                     | pendiente |

## Log

- **L1** (2026-10-23) — El usuario decide, al cerrar `componentizar-y-optimizar`: **"reglas ahora + paginación aparte"** para el ordenamiento y **"dejarla y esperar a la paginación"** para la vista de las cifras. Motivo: la paginación es lo que hace que la vista deje de doler (y sin paginación el filtro por cliente no lo usa nadie, así que el problema es teórico).
- **L2** (2026-10-23) — Mediciones tomadas para decidir (4.800 ventas, 20 corridas promediadas, con las consultas reales del repo): la vista con `GROUP BY` paga 9,3 ms en el filtro por cliente y 13-16 ms en el resto; la de subconsultas paga 0,8 ms en el filtro y 15-16 ms en el resto. Las dos dan **las mismas cifras** (ya pineado).
- **L3** (2026-10-23) — **La trampa**: con la vista actual, paginar sin cambiar la vista hace que **cada página pague el costo de todo el historial**. T1 (la vista) es prerrequisito de T2 (la paginación).
