/**
 * E2E: eliminar una venta via la UI.
 *
 * Pasos:
 *  1. BD con 2 ventas (seed).
 *  2. Visita `/`.
 *  3. Click en el producto de la primera fila → `/sales/1`.
 *  4. Click "Eliminar".
 *  5. Aparece confirmación "¿Eliminar ...?".
 *  6. Click "Sí, eliminar".
 *  7. Redirige a `/`, solo queda 1 fila, KPI Total=1.
 */
import { expect } from '@playwright/test';
import { clearAllSales, expectTotal, gotoHome, test } from './fixtures';

test.beforeEach(async ({ request, seedSales }) => {
  await clearAllSales(request);
  await seedSales([
    {
      product_name: 'iPhone 12',
      cost_cents: 15000,
      price_cents: 25000,
      sold: true,
    },
    {
      product_name: 'Libro TypeScript',
      cost_cents: 1200,
      price_cents: 2500,
      sold: false,
    },
  ]);
});

test('eliminar una venta la quita de la tabla y actualiza KPIs', async ({ page }) => {
  await gotoHome(page);

  // Ambas filas visibles al inicio
  await expect(page.getByText('iPhone 12')).toBeVisible();
  await expect(page.getByText('Libro TypeScript')).toBeVisible();
  await expectTotal(page, 2);

  // Navegamos a la página de edición de la primera venta
  await page.getByRole('link', { name: 'iPhone 12' }).click();
  await page.waitForURL(/\/sales\/\d+$/);

  // Click en "Eliminar" → aparece la confirmación
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByText(/Esta acción no se puede deshacer/)).toBeVisible();

  // Confirmar
  await page.getByRole('button', { name: 'Sí, eliminar' }).click();

  // Redirige a /
  await page.waitForURL('/', { timeout: 10_000 });
  await gotoHome(page);

  // Solo queda 1 fila
  await expect(page.getByText('iPhone 12')).toHaveCount(0);
  await expect(page.getByText('Libro TypeScript')).toBeVisible();
  await expectTotal(page, 1);
});