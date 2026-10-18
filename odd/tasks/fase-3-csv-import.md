# Feature: Fase 3 — Importación CSV de ventas

> Importar ventas masivamente desde un CSV. Las cabeceras del CSV son los **mismos nombres** que los campos del form manual (`product_name`, `cost_cents`, `price_cents`, etc.). Auto-mapeo directo (sin UI de "elegir columna para campo"). Validación atómica: si una fila falla, no se importa nada.

## Specs

- **S1**: Cabeceras del CSV = nombres exactos de los campos de `CreateSaleInput` (`product_name`, `buyer_name`, `cost_cents`, `price_cents`, `associated_costs_cents`, `sold`, `purchase_date`, `sold_at`, `notes`). Si falta una cabecera obligatoria (solo `product_name` lo es), el parser falla con error claro listando qué falta. Cabeceras desconocidas se ignoran con warning.
- **S2**: Todos los importes en **céntimos** (entero). Si llegan valores en euros con decimales (ej. `150.50`), el parser los rechaza con error por fila. Esta convención se documenta en el placeholder del input file y en el AGENTS.md.
- **S3**: Endpoint nuevo `POST /api/sales/import` que recibe `{ sales: CreateSaleInput[] }` (validado con Zod). Si **todas** las filas pasan validación → inserta todas en una **transacción SQLite** atómica (todo-o-nada). Devuelve `{ imported: number, ids: number[] }` con 201. Si **alguna** fila falla validación del schema → 422 con array de issues por fila y no se inserta NADA.
- **S4**: Página `/sales/import` con:
  - Input file (drag/drop + click).
  - Botón "Cancelar" para volver a `/`.
  - Tras seleccionar archivo: aparece un **preview** con las primeras 10 filas, cada una con un badge verde ("OK") o rojo ("inválida — razón"). El estado se calcula en el cliente con `CreateSaleInput.safeParse` por fila (mismo schema que el server).
  - Si **todas** las filas son válidas → botón "Importar N ventas" habilitado.
  - Si **alguna** fila es inválida → el botón queda deshabilitado y se muestra "X filas inválidas (ver detalle)" con la lista de razones.
  - Tras importar OK → redirect a `/` con toast "Importaste N ventas".
- **S5**: En la página principal (`SalesListPage`) aparece un nuevo link "Importar CSV" arriba a la derecha, junto al "+ Nueva venta".
- **S6**: Validación cliente / server usan el mismo schema `CreateSaleInput` (mirror que seguimos manteniendo). Lo que se muestra en el preview coincide con lo que el server acepta. Defensa en profundidad: si el cliente omite la validación por bug, el server la aplica igual.
- **S7**: Test E2E con Playwright: subir un CSV fixture (`web/e2e/fixtures/sample.csv`) con 3 filas válidas, ver el preview verde, importar, y verificar que la tabla de `/` tiene las 3 filas nuevas y los KPIs se actualizaron.
- **S8**: AGENTS.md sección **"Fases del proyecto"** marca Fase 3 como ✅ y la **"Estructura"** agrega la página `SalesImportPage.tsx` y los componentes `UploadCSV` / `ImportPreview`. La sección **"Próximo paso inmediato"** queda apuntando a Fase 4.

## Tasks

| ID  | Título                                                                             | Specs        | Ruta                                                                                                                          | Commit |
| --- | ---------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| T1  | Schema Zod server para el body del import                                          | S3           | `server/src/schemas/sales-import.ts`                                                                                          | WU1    |
| T2  | Repo: `createMany(sales[])` con `db.transaction`                                   | S3           | `server/src/repo/sales-repo.ts`                                                                                               | WU1    |
| T3  | Endpoint `POST /api/sales/import`                                                  | S3           | `server/src/routes/sales.ts`                                                                                                  | WU1    |
| T4  | Tests server: import OK, fila inválida aborta todo, validación 422                 | S3           | `server/src/__tests__/sales-import.test.ts`                                                                                   | WU1    |
| T5  | Cliente HTTP `salesApi.import(...)` + hook `useImportSales`                        | S3, S4       | `web/src/api/sales.ts`, `web/src/hooks/useImportSales.ts`                                                                     | WU2    |
| T6  | Página `SalesImportPage` + componentes `UploadCSV` e `ImportPreview` con papaparse | S1, S2, S4   | `web/src/pages/SalesImportPage.tsx`, `web/src/components/import/UploadCSV.tsx`, `web/src/components/import/ImportPreview.tsx` | WU2    |
| T7  | Ruta `/sales/import` en `App.tsx` + link "Importar CSV" en `SalesListPage`         | S5           | `web/src/App.tsx`, `web/src/pages/SalesListPage.tsx`                                                                          | WU2    |
| T8  | Fixture `sample.csv` + test E2E `import-flow.spec.ts`                              | S7           | `web/e2e/fixtures/sample.csv`, `web/e2e/import-flow.spec.ts`                                                                  | WU3    |
| T9  | AGENTS.md documenta Fase 3 + nueva ruta                                            | S8           | `AGENTS.md`                                                                                                                   | WU3    |
| T10 | Smoke manual checklist en este feature doc (Log)                                   | (validación) | `odd/tasks/fase-3-csv-import.md` (Log)                                                                                        | WU3    |

**Work units (commits)**:

- **WU1 (server, T1–T4)**: schema + repo + endpoint + tests. Riesgo item 3 (cambia contrato API) + item 6 (sin tests no se detecta).
- **WU2 (web estructural, T5–T7)**: cliente + página + componentes + ruta. Riesgo bajo si WU1 está.
- **WU3 (validación, T8–T10)**: E2E con CSV real + docs.

## Decisiones de producto (L2 del Log)

- **Origen del CSV**: cabecera-igual-a-form, sin UI de mapeo (decisión del usuario 2026-10-17 vía `ask_user_question`).
- **Errores por fila**: rechazar todo el batch (decisión del usuario 2026-10-17). Atomicidad garantizada por `db.transaction` de `better-sqlite3`.

## Log

- **L1** (2026-10-17, request del usuario): "sigue con el desarrollo". Encadenado del flow "validar feature actual → arreglar race condition → push → arrancar Fase 3". Decisiones sobre Fase 3 confirmadas vía `ask_user_question`: headers idénticos al schema (sin UI de mapeo) y batch atómico (todo o nada).
- **L2** (2026-10-17, cierre WU1 server): `ImportSalesInput` schema (SalesCreateInput[] con min(1)/max(1000)), `createMany` repo (`db.transaction` + único `now` por batch), endpoint `POST /api/sales/import` (422 si fila inválida, 201 con `{ imported, ids }`), 11 tests nuevos (50/50 verde del server).
- **L3** (2026-10-17, cierre WU2 web): `papaparse` agregado a `web/package.json`, `salesApi.import(...)` + `ImportResult` type, `useImportSales` hook, componentes `UploadCSV` (drag/drop + papaparse con `header: true, dynamicTyping: false`) y `ImportPreview` (tabla verde/rojo, primeras 10 filas), página `SalesImportPage` (orquesta parseo → validación Zod fila por fila → botón "Importar N ventas" deshabilitado si hay inválidas), ruta `/sales/import` en `App.tsx` (antes de `/:id`), link "Importar CSV" en `SalesListPage`.
- **L4** (2026-10-17, cierre WU3 validación): fixture CSV `web/e2e/fixtures/sample.csv` con 3 filas (1 con sold/purchase_date, 1 todo null, 1 con fechas), spec Playwright `import-flow.spec.ts` con 2 tests (flujo feliz + fila inválida deshabilita botón). **7/7 Playwright verde** (suma los 5 specs previos de Fases 1-2). `AGENTS.md` actualizado: sección 4 (Estructura) agrega páginas `SalesImportPage`/`UploadCSV`/`ImportPreview` + hook `useImportSales` + `papaparse`; sección 7 marca Fase 3 como ✅; sección 12 redirige a Fase 4.
- **L5** (Smoke manual — opcional, los E2E ya cubren el flujo):
  ```powershell
  # desde la raíz del repo
  fnm use 20
  npm install   # solo si hace falta (papaparse se agregó en WU2)
  npm run dev   # backend :4000, frontend :5173

  # Abrir http://localhost:5173 y click en "Importar CSV" arriba a la derecha.
  # Subir web/e2e/fixtures/sample.csv (o uno propio con headers iguales a los
  # del schema). Esperado: preview con 3 filas verdes, botón "Importar 3 ventas",
  # redirect a / con toast y KPIs actualizados (Total=3, Vendidas=2).
  ```
  Si algo falla, anotar en este Log como L6 y abrir feature doc de bugfix.
