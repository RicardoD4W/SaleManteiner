# Feature: componentizar, una fuente de la verdad y optimizar

Cerrar la deuda técnica que dejó la auditoría: **reutilizar** lo que está duplicado, dejar **una sola fuente de la verdad** para cada cosa y **optimizar** (índices, SQL preparado, TOCTOU).

**Riesgo del feature**: item 3 (se tocan contratos que otros consumen: las cifras del dashboard, el contrato HTTP y el foco de los modales) — mitigado con los gates (typecheck, lint, format, tests, e2e) y **verificación visual** en las unidades que tocan la UI.

## Specs

### S1 — Reutilizar: un componente donde hoy hay copias

> "si tenemos la misma estructura podemos componetizar y reutilizar"

- El **shell de modal** (backdrop + `role="dialog"` + header + botón cerrar + footer) vive hoy **6 veces** → un `<Modal>` con slots, y el foco/Escape unificados (3 de los 6 modales hoy manejan el Escape a mano y no atrapan el Tab).
- La **tabla con la fila "armada"** está duplicada entre `/buys` y `/solds` (~80 líneas: `transitionName`, `readArmedRow`, `ArmedRowContext`, `TravellingCell`, `ActionsCell`) → un componente parametrizado.
- El **flujo de borrado en cascada** (409 → modal de cascada) está implementado dos veces (`DeleteDialogs` y `DeleteCustomerDialogs`, con los mismos 4 estados) → un hook compartido.

### S2 — Una sola fuente de la verdad

> "solo debemos de tener una fuente de la verdad"

- **Las cifras del dashboard**: la fórmula de prorrateo (COGS) está **6 veces** y la de beneficio **3 veces** (con distinto agrupamiento) → **vistas SQL** en una migración nueva, y los repos consultan la vista.
- **Los schemas de los forms**: redeclaran en local lo que ya está en `web/src/schemas/` (y ya divergieron: `.default(0)` en un lado y no en el otro) → derivarlos del schema.
- **La validación del form de cliente**: `buildResolver()` reimplementa a mano lo que `zodResolver` ya hace en las otras 3 formas → `zodResolver`.
- **Los tipos del 409** ya están unificados en `api/types.ts` ✓ (hecho en la auditoría).

### S3 — Optimizar

> "optimizar, reducir codigo y corregir posiblwes errores futuros"

- **Índices**: `idx_sale_items_sold` duplica el prefijo del PK `(sold_id, buy_id)` → no aporta nada → se va. Los índices de fecha se **miden** (`EXPLAIN QUERY PLAN`) antes de decidir: si no los usa el planner, se van o se reescribe el filtro para que sirvan.
- **Statements**: `better-sqlite3` no cachea el SQL → los `db.prepare()` que hoy están **dentro de las funciones** (5/7/7 por repo) se suben al factory (se compilan una vez).
- **TOCTOU**: la ruta comprueba la existencia y el repo la vuelve a comprobar → el repo devuelve un resultado discriminado y la ruta mapea al 404 (una sola comprobación).
- **Menos código**: lo que se unifica se borra (copias, `forwardRef` de React 18, helpers que quedan sin uso).

## Tasks

| ID  | Spec       | Ruta                                                         | Commit |
| --- | ---------- | ------------------------------------------------------------ | ------ |
| T1  | S2, S3     | server: vistas SQL (fuente de verdad de las cifras) + índices | WU1    |
| T2  | S3         | server: statements en el factory + TOCTOU                    | WU2    |
| T3  | S1, S2     | web: hook de cascada, `zodResolver`, `forwardRef`, schemas  | WU3    |
| T4  | S1         | web: `<Modal>` compartido (6 modales)                         | WU4    |
| T5  | S1         | web: tabla con fila armada parametrizada                     | WU5    |
| T6  | S1-S3      | gates + verificación visual                                   | WU6    |

## Log

- **L1** (2026-10-23) — El usuario pide cerrar la deuda técnica: "si tenemos la misma estructura podemos componetizar y reutilizar no? eso hara un mejor software, solo debemos de teenr una fuente de la verdad, si el indice entorpecerá quitemoslo, el 6 hayq acerlo optimo, 7. arreglalo. Como resumen optimizar, reducir codigo y corregir posiblwes errores futuros".
- **L2** (2026-10-23) — Los 5 detalles de la tabla de la auditoría anterior (CORS abierto, `cursor-pointer` en 16 botones crudos, anillo de foco del "Borrar", `role="status"` del Spinner y la paginación de D7) quedan **descartados** por el usuario: no se tocan.
