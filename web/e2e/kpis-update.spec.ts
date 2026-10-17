/**
 * E2E: los KPIs reflejan las operaciones de la UI.
 *
 * Pasos:
 *  1. BD con 2 ventas iniciales (1 vendida + 1 pendiente). Verificar KPIs.
 *  2. Crear una tercera venta vendida via UI.
 *  3. Verificar que Total, Vendidas, Ingresos, Beneficio neto reflejan los nuevos valores.
 */
import { expect } from '@playwright/test';
import {
  clearAllSales,
  expectNetProfit,
  expectTotal,
  gotoHome,
  test,
} from './fixtures';

test.beforeEach(async ({ request, seedSales }) => {
  await clearAllSales(request);
  await seedSales([
    {
      product_name: 'iPhone 12',
      cost_cents: 15000, // 150€
      price_cents: 25000, // 250€
      associated_costs_cents: 500, // 5€
      sold: true,
    },
    {
      product_name: 'Libro TypeScript',
      cost_cents: 500, // 5€
      price_cents: 1000, // 10€
      sold: false,
    },
  ]);
});

test('los KPIs se actualizan después de crear una venta via UI', async ({ page }) => {
  // 1. Estado inicial
  await gotoHome(page);
  await expectTotal(page, 2);

  // Cálculo inicial del beneficio neto:
  //   revenue = 25000 (solo del iPhone vendido)
  //   cost = 15000 + 500 = 15500 cents
  //   associated = 500
  //   net = 25000 - 15500 - 500 = 9000 cents = 90€
  await expectNetProfit(page, 9000);

  // 2. Creamos una tercera venta vendida via UI
  await page.goto('/sales/new');
  await page.getByLabel('Producto *').fill('Camiseta');
  await page.getByLabel('Coste (€)').fill('5');
  await page.getByLabel('Precio de venta (€)').fill('15');
  await page.getByLabel(/Ya lo vendí/).check();
  await page.getByRole('button', { name: 'Crear venta' }).click();
  await page.waitForURL('/', { timeout: 10_000 });
  await gotoHome(page);

  // 3. KPIs reflejan la nueva venta
  await expectTotal(page, 3);
  await expect(page.getByText('Camiseta')).toBeVisible();

  // Nuevo cálculo del beneficio neto:
  //   revenue = 25000 + 1500 = 26500 cents
  //   cost = 15500 + 500 = 16000 cents
  //   associated = 500
  //   net = 26500 - 16000 - 500 = 10000 cents = 100€
  await expectNetProfit(page, 10000);
});