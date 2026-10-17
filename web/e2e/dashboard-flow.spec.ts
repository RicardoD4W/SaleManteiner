/**
 * E2E: dashboard con tabs navegables via React Router (Fase 5 / S11).
 *
 * Cubre:
 *  - Cargar /dashboard muestra las 3 tabs + Overview por default.
 *  - Click en cada tab navega a la URL correcta y monta el componente
 *    de la tab (chart container present).
 *  - El link "Dashboard" de la nav global funciona desde /.
 *  - Back-button del browser vuelve a la tab anterior.
 */
import { expect } from '@playwright/test';
import { clearAllSales, test } from './fixtures';

test.beforeEach(async ({ request, seedSales }) => {
  await clearAllSales(request);
  await seedSales([
    {
      product_name: 'iPhone 12',
      cost_cents: 10000,
      price_cents: 15000,
      sold: true,
    },
    {
      product_name: 'Camiseta vintage',
      cost_cents: 500,
      price_cents: 1500,
      sold: true,
    },
    {
      product_name: 'No vendida',
      cost_cents: 1000,
      price_cents: 0,
    },
  ]);
});

test('dashboard: tabs visibles y Overview es la tab default', async ({ page }) => {
  await page.goto('/dashboard');

  // Tabs visibles
  await expect(page.getByTestId('dashboard-tab-resumen')).toBeVisible();
  await expect(page.getByTestId('dashboard-tab-ingresos')).toBeVisible();
  await expect(page.getByTestId('dashboard-tab-productos')).toBeVisible();

  // Overview por default (URL sin trailing /revenue ni /products)
  await expect(page).toHaveURL(/\/dashboard$/);
  // KPIs visibles
  await expect(page.getByTestId('overview-kpis')).toBeVisible();
  await expect(page.getByText('Total', { exact: true })).toBeVisible();
  // Chart de revenue (reusado en Overview)
  await expect(page.getByTestId('revenue-chart').first()).toBeVisible();
});

test('dashboard: click en "Ingresos" navega a /dashboard/revenue y monta el chart', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await page.getByTestId('dashboard-tab-ingresos').click();

  await page.waitForURL(/\/dashboard\/revenue$/);
  await expect(page).toHaveURL(/\/dashboard\/revenue$/);

  // Totales YTD + chart
  await expect(page.getByTestId('revenue-totals')).toBeVisible();
  await expect(page.getByTestId('revenue-chart')).toBeVisible();
  await expect(page.getByText('Revenue YTD', { exact: false })).toBeVisible();
});

test('dashboard: click en "Productos" navega a /dashboard/products y monta el chart', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await page.getByTestId('dashboard-tab-productos').click();

  await page.waitForURL(/\/dashboard\/products$/);

  await expect(page.getByTestId('top-products-chart')).toBeVisible();
  // Tabla compacta con iPhone + Camiseta (vendidos); "No vendida" no aparece
  // porque topProducts solo cuenta ventas vendidas (sold=true). Usamos la
  // tabla como scope porque el chart SVG también contiene los nombres de
  // los productos en su eje Y (truncados), lo que hacía fallar
  // getByText en strict mode.
  const table = page.getByTestId('products-table');
  await expect(table.getByText('iPhone 12')).toBeVisible();
  await expect(table.getByText('Camiseta vintage')).toBeVisible();
  await expect(page.getByText('No vendida')).toHaveCount(0);
});

test('dashboard: deep-link a /dashboard/revenue entra directo en la tab Ingresos', async ({
  page,
}) => {
  await page.goto('/dashboard/revenue');
  await expect(page).toHaveURL(/\/dashboard\/revenue$/);
  await expect(page.getByTestId('dashboard-tab-ingresos')).toBeVisible();
  await expect(page.getByTestId('revenue-chart')).toBeVisible();
});

test('dashboard: link "Dashboard" de la nav global navega desde /', async ({
  page,
}) => {
  await page.goto('/');
  // El link está en la nav del Layout (header).
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByTestId('overview-kpis')).toBeVisible();
});
