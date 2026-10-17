/**
 * E2E: editar una venta existente via la UI.
 *
 * Pasos:
 *  1. BD con 1 venta (seed).
 *  2. Visita `/`.
 *  3. Click en el producto (link a `/sales/:id`).
 *  4. Cambia el precio de venta a 300€.
 *  5. Click "Guardar cambios".
 *  6. Redirige a `/` y ve el nuevo precio en la fila.
 */
import { expect } from '@playwright/test';
import { clearAllSales, gotoHome, test } from './fixtures';

test.beforeEach(async ({ request, seedSales }) => {
  await clearAllSales(request);
  await seedSales([
    {
      product_name: 'iPhone 12',
      cost_cents: 15000,
      price_cents: 25000,
      associated_costs_cents: 500,
      sold: true,
    },
  ]);
});

test('editar el precio refleja el cambio en la tabla', async ({ page }) => {
  await gotoHome(page);
  await expect(page.getByText('iPhone 12')).toBeVisible();

  // Click en el link del producto (va a /sales/:id)
  await page.getByRole('link', { name: 'iPhone 12' }).click();
  await page.waitForURL(/\/sales\/\d+$/);

  // Estamos en la página de edición. Cambiamos el precio.
  await expect(page.getByRole('heading', { name: 'Editar venta' })).toBeVisible();
  const priceInput = page.getByLabel('Precio de venta (€)');
  await priceInput.fill('');
  await priceInput.fill('300');

  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  // Redirige a /
  await page.waitForURL('/', { timeout: 10_000 });
  await gotoHome(page);

  // El precio nuevo aparece formateado. Usamos .first() porque 300 €
  // aparece también en el KPI "Ingresos" (300,00 €).
  await expect(page.getByText(/300,00/).first()).toBeVisible();
});