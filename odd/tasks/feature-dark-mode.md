# Feature: `dark mode` — toggle sol/luna con persistencia

> SaleManteiner gana modo claro/oscuro. Default dark si el sistema operativo no tiene preferencia. Toggle en el header (botón sol/luna). Persistencia en `localStorage`. Los componentes del feature `buys-and-solds.md` que se creen después heredan automáticamente la convención porque el scaffolding con `@custom-variant dark (&:where(.dark, .dark *));` ya está en `web/src/index.css`.

## Specs

- **S1 — Default dark si no hay preferencia del sistema.** En la primera visita (sin valor en `localStorage`):
  - Si `window.matchMedia('(prefers-color-scheme: dark)').matches === true`, arrancar en light (o sea, **seguir la preferencia del sistema operativo**).
  - Si no hay match (sistema sin preferencia explícita), arrancar en **dark**.
  - Si el usuario tocó el toggle alguna vez, gana la elección persistida en `localStorage`.

  Implementación: clave `salemanteiner-theme` en `localStorage` con valores `"light"` | `"dark"`. Si está ausente, se respeta `matchMedia`; si tampoco hay match, default dark.

- **S2 — Toggle sol/luna en el header.** Botón `<button type="button" aria-label="Cambiar tema" data-testid="theme-toggle">` dentro del `<header>` del `Layout`, posicionado a la derecha del nav, antes del botón "+ Nueva" si existe. Ícono `Sun` (lucide-react o SVG inline) cuando el tema actual es dark (porque click va a light); ícono `Moon` cuando el tema actual es light.

- **S3 — Aplicar `dark:` a las páginas legacy.** Pasa siguiente: `Layout`, `SalesListPage`, `SaleNewPage`, `SaleEditPage`, `SalesImportPage`, `DashboardPage` + 3 tabs (`OverviewTab`, `RevenueTab`, `ProductsTab`), `SalesTable`, `KpiCards`, `SaleForm`, `DeleteSaleButton` (si existe), `RevenueChart` y `TopProductsChart` (SVG strokes/fills), `ImportPreview`, `UploadCSV`, y los UI primitivos `Card`, `Badge`, `Button`, `Input`, `Textarea`, `Spinner`.

- **S4 — Sin flash of light content.** Antes de que React monte, leer `localStorage` y aplicar `document.documentElement.classList.toggle('dark')` en el `<script>` del `index.html` (`<head>`) o antes del `createRoot` en `main.tsx`. Sin esto, el primer paint sale en light y luego salta a dark (FOUC visual).

- **S5 — Persistencia en `localStorage`** (clave `salemanteiner-theme`). Sin servidor. Sin cookies.

- **S6 — Cambio instantáneo.** El toggle alterna el tema sin animación. El estado actual se mantiene hasta el siguiente click; no auto-detecta cambios del SO en vivo (la app es local, no necesita `matchMedia.addEventListener` reactivo).

- **S7 — Compatibilidad con el feature `buys-and-solds` (en cola).** Los componentes que cree el WU2/WU3 del feature actual (`web/src/pages/buys/*`, `web/src/pages/solds/*`, `web/src/components/sales/ProductPickerModal.tsx`, `web/src/components/sales/CustomerAutocomplete.tsx`, etc.) deben usar `dark:` desde el día 1, siguiendo la paleta de tokens de `index.css` (`bg-white dark:bg-gray-900`, `text-gray-900 dark:text-gray-100`, `border-gray-200 dark:border-gray-700`, etc.). Esto es un compromiso documentado en este feature, no un cambio a futuro.

- **S8 — Tests:**
  - **S8a (server)**: nada cambia en backend; este feature no toca el servidor.
  - **S8b (web, Vitest)**: hook `useTheme` con happy-dom o jsdom — testea los tres estados (default con matchMedia dark, default con matchMedia light, valor persistido en localStorage) y que `toggle()` actualiza `document.documentElement.classList` y `localStorage`.
  - **S8c (web, snapshot)**: `ThemeToggle` renderiza con el ícono correcto según el tema actual (`dark` → sol, `light` → luna).
  - **S8d (E2E Playwright, opcional)**: `dark-mode.spec.ts` — abrir `/`, click toggle, assert que `documentElement.classList` contiene `'dark'` (o `''`), recargar y assert que persiste.

- **S9 — Accesibilidad:** el botón tiene `aria-label` claro y `aria-pressed` opcional (no es estrictamente necesario para un toggle de tema; basta el `aria-label`). Los íconos son decorativos (`aria-hidden="true"`).

- **S10 — Sin cambios en backend ni en tests server.** Cero impacto en el modelo de datos, los endpoints, los schemas Zod ni los tests del server.

## Tasks

| ID  | Título                                                          | Specs      | Ruta                                                                                                                | Commit |
| --- | --------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| T1  | Hook `useTheme()` con localStorage + matchMedia                 | S1, S5, S6 | `web/src/hooks/useTheme.ts` (nuevo)                                                                                  | WU1    |
| T2  | Componente `<ThemeToggle/>` con ícono Sun/Moon                  | S2, S9     | `web/src/components/layout/ThemeToggle.tsx` (nuevo)                                                                 | WU1    |
| T3  | Anti-FOUC en `index.html` + `main.tsx`                          | S4         | `web/index.html`, `web/src/main.tsx`                                                                                  | WU1    |
| T4  | Integrar `<ThemeToggle/>` en `<Layout/>`                        | S2         | `web/src/components/layout/Layout.tsx`                                                                                | WU1    |
| T5  | Aplicar `dark:` a UI primitivos (`Card`, `Badge`, `Button`, `Input`, `Textarea`, `Spinner`) | S3 | `web/src/components/ui/*`                                                                              | WU2    |
| T6  | Aplicar `dark:` a páginas legacy (`SalesListPage`, `SaleNewPage`, `SaleEditPage`, `SalesImportPage`) | S3 | `web/src/pages/Sale*.tsx`, `web/src/pages/SalesListPage.tsx`, `web/src/pages/SalesImportPage.tsx`            | WU2    |
| T7  | Aplicar `dark:` a componentes de lista y form (`SalesTable`, `KpiCards`, `SaleForm`, `DeleteSaleButton`) | S3 | `web/src/components/sales/*`                                                                              | WU2    |
| T8  | Aplicar `dark:` a dashboard (`DashboardPage` + 3 tabs + 2 charts SVG) | S3 | `web/src/pages/dashboard/*`, `web/src/components/dashboard/*`                                                     | WU2    |
| T9  | Aplicar `dark:` a componentes de import (`UploadCSV`, `ImportPreview`) | S3 | `web/src/components/import/*`                                                                              | WU2    |
| T10 | Tests Vitest: hook `useTheme` + snapshot `ThemeToggle`          | S8b, S8c   | `web/src/hooks/__tests__/useTheme.test.ts` (nuevo), `web/src/components/layout/__tests__/ThemeToggle.test.tsx` (nuevo) | WU3    |
| T11 | Spec Playwright: `dark-mode.spec.ts` (toggle + persistencia)    | S8d        | `web/e2e/dark-mode.spec.ts` (nuevo)                                                                                   | WU3    |
| T12 | AGENTS.md: documenta convención `dark:` + skill `tailwind-css-patterns` recordada | S7, (docs) | `AGENTS.md`                                                                                                          | WU3    |
| T13 | Smoke manual checklist en este feature doc (Log)                | (validación) | `odd/tasks/feature-dark-mode.md` (Log)                                                                              | WU3    |

**Work units (commits separados)**:

- **WU1 — dark mode core (T1-T4)**: el contrato del tema. ~150 líneas. Riesgo: ninguno si Tailwind `@custom-variant dark` está bien configurado (verificado en `web/src/index.css` línea 3).
- **WU2 — dark mode aplicación (T5-T9)**: pase por ~15 archivos agregando clases `dark:`. Riesgo: ninguno si se mantiene la convención documentada (no usar colores hardcodeados fuera de la paleta).
- **WU3 — tests + docs + smoke (T10-T13)**: tests del hook, snapshot del botón, E2E opcional, AGENTS.md con la convención, smoke manual en el Log.

## Decisiones de producto (cerradas)

- **Default**: dark si el sistema no tiene preferencia (`prefers-color-scheme: no preference`).
- **Toggle**: botón sol/luna en el header, antes de "+ Nueva". `aria-label="Cambiar tema"`.
- **Persistencia**: `localStorage` con clave `salemanteiner-theme`.
- **Sin servidor, sin login**, sin sincronización entre pestañas (clásico bug: dos tabs con temas distintos; aceptable para MVP).
- **Sin `react-mode-toggle` ni librería externa**: implementación propia con `lucide-react` (que ya está, ¿?) o SVG inline si no está. Verificar primero.

## Log

- **L1** (request del usuario, textual): _"pues dale, vamos a implementarlo. Tmb he de decir que me gustaria agregar un modo claro/oscuro al front"_.
- **L2** (decisiones de scope): el usuario eligió (a) feature separado, ANTES de `feature-buys-and-solds.md`, (b) default dark si el sistema no tiene preferencia, (c) botón sol/luna en el header. Esto permite que los componentes nuevos del feature actual hereden la convención y nazcan con `dark:` incluido, evitando dos pasadas por componente.
- **L3** (cierre WU1 core — pendiente): T1 hook `useTheme` (lee localStorage, fallback a matchMedia, fallback a dark); T2 componente `<ThemeToggle/>` con íconos Sun/Moon; T3 anti-FOUC en `index.html` `<head>` + `main.tsx` antes del `createRoot`; T4 integración en `Layout.tsx`. Riesgo verificado: `@custom-variant dark` ya está en `index.css:3`, no requiere tocar el CSS.
- **L4** (cierre WU2 aplicación — pendiente): T5-T9 agregar `dark:` a UI primitivos, páginas, componentes de lista/form, dashboard e import. Convención de colores: `bg-white dark:bg-gray-900`, `text-gray-900 dark:text-gray-100`, `border-gray-200 dark:border-gray-700`, `bg-gray-50 dark:bg-gray-800`, etc. NO usar colores hardcodeados (`bg-gray-100`, `text-red-700`) sin su contraparte dark.
- **L5** (cierre WU3 validación — pendiente): T10 tests Vitest del hook + snapshot del botón; T11 spec Playwright; T12 `AGENTS.md` documenta convención; T13 smoke manual.
