# Fase 2 — Tests retroactivos del frontend MVP

> Feature document. **Alcance retroactivo**: agregar cobertura automatizada al código del frontend de Fase 2 (que ya está implementado y verificado por smoke E2E manual). Stack: Vitest 5 + Testing Library + jsdom.

## Contexto y motivación

El usuario reafirmó el principio "los tests van de la mano con el desarrollo". La Fase 2 quedó implementada sin tests automatizados del frontend (deuda documentada en `AGENTS.md §13`). Este feature doc cierra esa deuda retroactivamente y sienta las bases para que Fase 3 en adelante se desarrolle con test-first desde el inicio.

Smoke E2E manual sigue siendo la verificación final de la integración real frontend↔backend; estos tests cubren unidad e integración de componentes/hooks/schemas con la API mockeada.

## Stack (solo devDependencies)

| Paquete                       | Versión | Uso                                                 |
| ----------------------------- | ------- | --------------------------------------------------- |
| `vitest`                      | 5.x     | Runner (ya está en server/ con Vitest 5; alineamos) |
| `@testing-library/react`      | 16.x    | Render de componentes con semantic queries          |
| `@testing-library/user-event` | 14.x    | Simulación de interacción realista (typing, click)  |
| `@testing-library/jest-dom`   | 6.x     | Matchers custom (`toBeInTheDocument`, etc.)         |
| `jsdom`                       | última  | Environment DOM para Vitest                         |
| `@testing-library/dom`        | última  | Dependencia transitiva de las anteriores            |

Sin agregar: `happy-dom` (jsdom alcanza), `msw` (mocks manuales son más simples para este alcance), `playwright`/`cypress` (queda para Fase 8).

## Estructura nueva

```
web/
├── vitest.config.ts             ← environment jsdom, alias @/ → src, setup
├── src/
│   ├── test-utils/
│   │   ├── setup.ts             ← importa @testing-library/jest-dom; limpia afterEach
│   │   ├── render.tsx           ← renderWithProviders(ui, { router? })
│   │   └── mocks.ts             ← mock de salesApi, mock de useNavigate, etc.
│   ├── schemas/__tests__/sales.test.ts
│   ├── lib/__tests__/format.test.ts
│   ├── api/__tests__/client.test.ts
│   ├── api/__tests__/sales.test.ts
│   ├── hooks/__tests__/{useCreateSale,useUpdateSale,useDeleteSale}.test.ts
│   ├── components/__tests__/{Button,Badge}.test.tsx
│   ├── components/sales/__tests__/{SalesTable,KpiCards,SaleForm}.test.tsx
```

Convención: `__tests__/` hermano del archivo que testea, nombre `<archivo>.test.ts(x)`. Coincide con lo que ya hace `server/src/__tests__/sales.test.ts`.

## Specs

### S1 — Configuración base

- `web/vitest.config.ts` con `environment: 'jsdom'`, `globals: false`, alias `@/` → `web/src`, `setupFiles: ['./src/test-utils/setup.ts']`.
- `web/src/test-utils/setup.ts` importa `@testing-library/jest-dom/vitest` y limpia mocks con `vi.clearAllMocks()` en `afterEach`.
- `web/package.json` suma scripts `"test": "vitest run"` y `"test:watch": "vitest"`.
- Cobertura: `npm --workspace web run test` corre la suite y sale con código 0 si todo pasa.

### S2 — Schemas Zod del frontend

`web/src/schemas/__tests__/sales.test.ts`:

- `CreateSaleInput.parse({ product_name: 'X' })` aplica defaults (`cost_cents=0`, `sold=false`, etc.) y rechaza claves extra (`.strict()`).
- `CreateSaleInput` rechaza `cost_cents: -1` (no negativo) y `cost_cents: 1.5` (no entero).
- `UpdateSaleInput.parse({})` da output `{}` (todo opcional).
- `UpdateSaleInput` acepta campos parciales sin quedarle.
- `Sale.parse(...)` rechaza `id: -1` (RowId positivo), `sold: 'true'` (string en vez de boolean).
- Round-trip: una `Sale` parseada y vuelta a `stringify`+`parse` da el mismo objeto.

### S3 — Formatters

`web/src/lib/__tests__/format.test.ts`:

- `formatCents(0) === '0,00 €'`.
- `formatCents(1250) === '12,50 €'`.
- `formatCents(-50) === '-0,50 €'` (no se valida en MVP pero `Intl` lo soporta).
- `centsToEuros(1250) === 12.5`.
- `eurosToCents(12.5) === 1250` (sin floats sucios).
- `eurosToCents(0.1 + 0.2) === 30` (caso clásico de float: 0.30000000000000004 → round → 30).
- `formatDate('2026-10-16T00:00:00.000Z')` retorna `"16/10/2026"` (o el día local correspondiente — el test usa regex o fija la TZ).
- `formatDateTime('2026-10-16T22:34:00.000Z')` retorna `"16/10/2026, 22:34"` (o el día/hora local).

### S4 — API client

`web/src/api/__tests__/client.test.ts`:

- `apiFetch` con respuesta OK y `data` envuelve y devuelve `data`.
- `apiFetch` con respuesta 400 y body `{ error: 'Bad', issues: [...] }` tira `ApiError` con `body.error === 'Bad'` y `body.issues.length === N`.
- `apiFetch` con respuesta 500 y body `{ error: 'Internal' }` tira `ApiError` con mensaje en español.
- `apiFetch` con error de red (fetch rejects) tira `ApiError` con mensaje `"Error de red"`.

### S5 — API sales (wrapper)

`web/src/api/__tests__/sales.test.ts` (mockeando `apiFetch`):

- `salesApi.list()` llama a `/api/sales` sin querystring.
- `salesApi.list({ sold: true, limit: 10, offset: 20 })` llama a `/api/sales?sold=true&limit=10&offset=20`.
- `salesApi.getById(5)` llama a `/api/sales/5`.
- `salesApi.create({...})` hace POST a `/api/sales` con body JSON.
- `salesApi.update(5, {...})` hace PATCH a `/api/sales/5` con body JSON.
- `salesApi.remove(5)` hace DELETE a `/api/sales/5`.
- `salesApi.stats()` llama a `/api/sales/stats`.

### S6 — Hooks de mutación

`web/src/hooks/__tests__/useCreateSale.test.ts` (y los otros dos análogos):

- Llama a `salesApi.create` con el input.
- En éxito invalida `['sales']` y `['stats']`.
- Propaga error si `salesApi.create` rechaza (la query queda en estado `error`).

Para `useUpdateSale`: invalida `['sales']`, `['stats']`, `['sales', id]`.
Para `useDeleteSale`: invalida `['sales']`, `['stats']`.

### S7 — Componentes UI primitivos

`web/src/components/__tests__/Button.test.tsx`:

- Renderiza children.
- Click handler se llama al hacer click (con `userEvent`).
- `variant="ghost"` aplica la clase esperada.
- `isLoading` muestra spinner y deshabilita el botón.

`web/src/components/__tests__/Badge.test.tsx`:

- Renderiza children.
- `variant="success"` aplica la clase esperada.
- Sin variant usa el estilo por defecto.

### S8 — SalesTable

`web/src/components/sales/__tests__/SalesTable.test.tsx` (mockeando `useSales`):

- Renderiza una fila por venta con el formato correcto (`formatCents` aplicado a columnas monetarias).
- Link "Editar" apunta a `/sales/:id`.
- Estado vacío (sin ventas) muestra "No hay ventas todavía" + link "Crear la primera →".
- Estado loading muestra "Cargando ventas…".
- Estado error muestra el mensaje y un botón "Reintentar" que llama a `refetch`.

### S9 — KpiCards

`web/src/components/sales/__tests__/KpiCards.test.tsx`:

- Renderiza 7 valores del objeto stats: total, vendidos, no vendidos, revenue, coste, costes asociados, beneficio neto (este último destacado).
- Cada valor monetario usa `formatCents`.

### S10 — SaleForm

`web/src/components/sales/__tests__/SaleForm.test.tsx`:

- Modo create: typing en campos → submit → `useCreateSale.mutateAsync` llamado con `cost_cents`/`price_cents`/`associated_costs_cents` convertidos de euros a cents (e.g. `12.5` → `1250`).
- Modo create: campos vacíos dispara mensajes de error en español ("El producto es obligatorio").
- Modo edit (con `sale` prop): pre-rellena con `centsToEuros(sale.cost_cents)` etc.
- Modo edit: submit → `useUpdateSale.mutateAsync` con `{ id, input }`.
- Error de la mutation se muestra en el `<p>` rojo de error.

### S11 — Verificación

- `npm --workspace web run test` corre la suite entera y termina con código 0.
- `npm run typecheck` (toda la solución) sigue OK.
- `npm run lint` sigue OK.
- `npm run build` sigue OK.

## Tasks

1. **T1** — Instalar devDeps (vitest 5, testing-library/react 16, testing-library/user-event 14, testing-library/jest-dom 6, jsdom) → S1.
2. **T2** — Crear `web/vitest.config.ts`, `web/src/test-utils/{setup,render,mocks}.ts`, agregar scripts `test` y `test:watch` → S1.
3. **T3** — Tests de schemas Zod → S2.
4. **T4** — Tests de formatters → S3.
5. **T5** — Tests de API client → S4.
6. **T6** — Tests de API sales (wrapper) → S5.
7. **T7** — Tests de hooks de mutación (create/update/delete) → S6.
8. **T8** — Tests de Button + Badge → S7.
9. **T9** — Tests de SalesTable → S8.
10. **T10** — Tests de KpiCards → S9.
11. **T11** — Tests de SaleForm → S10.
12. **T12** — Verificación completa (test, typecheck, lint, build) → S11.

## Verificación

```powershell
npm --workspace web run test          # suite completa, debe terminar con código 0
npm run typecheck                     # web + server, OK
npm run lint                          # web + server, max-warnings 0
npm run build                         # web + server
```

Smoke E2E manual del frontend contra el backend sigue siendo el siguiente paso después de este doc (ver `AGENTS.md §12`).

## Deuda técnica

- **Sin tests E2E con backend real** (Playwright). Los hooks usan mocks manuales; un test de integración real con Express levantado en puerto random queda para Fase 8.
- **Sin tests de las páginas** (`SalesListPage`, `SaleNewPage`, `SaleEditPage`). Se testean sus componentes internos en su lugar; las páginas son wrappers finos.
- **Cobertura numérica no objetivo** en este alcance. Se prioriza lo crítico: schemas (contrato), formatters (UX), hooks de mutación (invalidaciones), formulario (lógica de submit), tabla (render).

## Log

- **L1** (2026-10-16, usuario): "los tests tienen que ir de la mano con el desarrollo y se irán actualizando corrigiendo o ampliando dependiendo del punto del desarrollo en el que estemos". Aceptado el enfoque "Fase 2 retroactiva + prospectivo" (Vitest + Testing Library + jsdom; mocks manuales en lugar de MSW para empezar).
- **L2** (2026-10-16): Stack fijado: Vitest 5 + @testing-library/react 16 + @testing-library/user-event 14 + @testing-library/jest-dom 6 + jsdom. Sin MSW ni Playwright en este alcance.
