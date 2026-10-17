# Feature: Fase 6 — Exportación CSV de ventas

> Botón "Exportar CSV" en la lista principal. Genera un archivo CSV con TODAS las ventas en la BD que se descarga al browser. Headers idénticos a los del import (Fase 3), cerrando el roundtrip: exportás → modificás en Excel/Sheets → reimportás.

## Specs

- **S1**: Endpoint nuevo `GET /api/sales/export` que devuelve un CSV con todas las ventas (sin paginación) en `text/csv; charset=utf-8`. Status 200 si OK, sin body JSON (el cuerpo ES el CSV, no un envelope).
- **S2**: Headers del CSV exportado (orden fijo, lowercase, snake_case): `product_name,buyer_name,cost_cents,price_cents,associated_costs_cents,sold,purchase_date,sold_at,notes`. Idénticos a los que `CreateSaleInput` espera en el import (Fase 3) — garantiza roundtrip limpio.
- **S3**: Encoding UTF-8 **con BOM** (`\ufeff`) al inicio del archivo. Sin BOM, Excel-español interpreta acentos/ñ como Latin-1 y muestra caracteres rotos (`Ã¡` por `á`). Sheets y Numbers manejan BOM sin problema.
- **S4**: Los importes van en céntimos (entero, sin redondeos): `cost_cents`, `price_cents`, `associated_costs_cents` como `15000` (no `150.00`). El usuario los formatea en su planilla si quiere ver euros.
- **S5**: `sold` se serializa como `true` o `false` (string, lowercase) — mismo formato que el import acepta.
- **S6**: Fechas: `purchase_date` como `YYYY-MM-DD` (lo que hay en BD), `sold_at` como ISO 8601 con offset (idem). Si son `NULL`, la celda queda vacía.
- **S7**: Escape CSV (RFC 4180): si un valor contiene `,`, `"`, `\n` o `\r`, se envuelve en comillas dobles y las comillas internas se duplican (`"He said ""hola"""`). Strings vacíos y `null` se exportan como celda vacía.
- **S8**: Botón "Exportar CSV" en `SalesListPage`, junto a "Importar CSV" y "+ Nueva venta". Al click, dispara download con filename `sales-YYYY-MM-DD.csv` (fecha local del export).
- **S9**: Tests E2E Playwright: se clickea el botón, se captura el download, se lee el contenido y se valida que tenga los headers esperados y al menos 1 fila de venta seedeada.
- **S10**: AGENTS.md sección **"Fases del proyecto"** marca Fase 6 como ✅. Sección 4 (Estructura) actualiza la renglón de `api/` agregando el método `export` y el botón en `SalesListPage`.

## Tasks

| ID  | Título | Specs | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1  | Repo: helper `serializeSaleToCsv(sales: Sale[])` + tests unit del serializer | S1, S2, S4-S7 | `server/src/repo/sales-repo.ts` (extender), `server/src/__tests__/sales-export.test.ts` | WU1 |
| T2  | Endpoint `GET /api/sales/export` (envuelve BOM + serializer) | S1, S3 | `server/src/routes/sales.ts` | WU1 |
| T3  | Cliente HTTP: `salesApi.exportUrl()` (solo devuelve URL) + helper `triggerDownload(filename)` | S8 | `web/src/api/sales.ts`, `web/src/lib/download.ts` | WU2 |
| T4  | Botón "Exportar CSV" en `SalesListPage` (con `download` attribute) | S8 | `web/src/pages/SalesListPage.tsx` | WU2 |
| T5  | Spec E2E Playwright: click botón → captura download → valida header + fila | S9 | `web/e2e/export-flow.spec.ts` | WU2 |
| T6  | AGENTS.md documenta Fase 6 + nueva ruta + botón | S10 | `AGENTS.md` | WU2 |
| T7  | Smoke manual checklist en este feature doc (Log) | (validación) | `odd/tasks/fase-6-csv-export.md` (Log) | WU2 |

**Work units (commits)**:

- **WU1 (server, T1–T2)**: serializer + endpoint + tests. Riesgo bajo — pure server, sin deps nuevas.
- **WU2 (web + docs, T3–T7)**: cliente + botón + E2E + docs + feature doc.

Esta feature es más chica que Fase 3: 2 commits en lugar de 3. La razón: casi no hay lógica nueva, es 90% serialización determinística.

## Log

- **L1** (2026-10-17, request del usuario): "sigue con el desarrollo". Después de cerrar Fase 3 (`21975fc` + `7a5abf1` pusheados), el usuario eligió Fase 6 sobre las alternativas de dashboard/scraping/cleanup.
- **L2** (2026-10-17, cierre WU1 server): helper puro `serializeSalesToCsv` en `server/src/csv-export.ts` con headers lowercase snake_case en orden fijo (`product_name,buyer_name,cost_cents,price_cents,associated_costs_cents,sold,purchase_date,sold_at,notes`), escape RFC 4180, `null` → celda vacía, booleanos como `true`/`false`, importes como céntimos literales. 11 tests nuevos (61/61 verde del server). Endpoint `GET /api/sales/export` con BOM UTF-8 al inicio + `Content-Disposition: attachment; filename=sales-YYYY-MM-DD.csv` + `Content-Type: text/csv; charset=utf-8`.
- **L3** (2026-10-17, cierre WU2 web + docs): `salesApi.exportUrl` (URL constante) + helper `triggerDownload(url, filename)` en `web/src/lib/download.ts` (crea `<a>` efímero + click programático). Botón "Exportar CSV" en `SalesListPage` entre los otros dos. Spec E2E Playwright `export-flow.spec.ts` que captura el download event, valida filename + BOM + headers + filas + Content-Disposition directo. **8/8 Playwright verde** (suma el export-flow a los 7 specs previos). AGENTS.md actualizado: sección 4 (`download.ts` en `lib/`), sección 7 (Fase 6 ✅), sección 12 (próximo paso apuntando a Fase 4 o 5).
- **L4** (Smoke manual — opcional, los E2E ya cubren el flujo):
    ```powershell
    # desde la raíz del repo
    fnm use 20
    npm install   # solo si hace falta
    npm run dev   # backend :4000, frontend :5173

    # Abrir http://localhost:5173, click en "Exportar CSV" arriba a la derecha.
    # Esperado: download de sales-YYYY-MM-DD.csv (UTF-8 con BOM, headers en español OK,
    # céntimos literales, fila de cada venta). Roundtrip: el mismo CSV puede re-importarse
    # desde "Importar CSV" sin tocar datos.
    ```
    Si algo falla, anotar como L5 y abrir feature doc de bugfix.
