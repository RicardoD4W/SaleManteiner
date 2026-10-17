/**
 * E2E: crear una venta via la UI.
 *
 * Pasos:
 *  1. BD vacía (clearAllSales en beforeEach).
 *  2. Visita `/sales/new`.
 *  3. Llena producto, coste, precio, marca "Ya lo vendí".
 *  4. Click "Crear venta".
 *  5. Redirige a `/`.
 *  6. La fila aparece con producto + importes formateados + badge "Sí".
 *  7. El KPI "Total" muestra 1, "Beneficio neto" muestra la diferencia.
 */
import { expect } from '@playwright/test';
import {
  clearAllSales,
  expectNetProfit,
  expectTotal,
  gotoHome,
  test,
} from './fixtures';

test.beforeEach(async ({ request }) => {
  await clearAllSales(request);
});

test('crear una venta end-to-end aparece en la tabla y actualiza KPIs', async ({ page }) => {
  // 1. Vamos al form de creación
  await page.goto('/sales/new');
  await expect(page.getByRole('heading', { name: 'Nueva venta' })).toBeVisible();

  // 2. Llenamos el form
  await page.getByLabel('Producto *').fill('iPhone 12 64GB');
  await page.getByLabel('Comprador').fill('Juan');
  await page.getByLabel('Coste (€)').fill('150');
  await page.getByLabel('Precio de venta (€)').fill('250');
  await page.getByLabel('Costes asociados (€)').fill('5');
  await page.getByLabel(/Ya lo vendí/).check();

  // 3. Submit
  await page.getByRole('button', { name: 'Crear venta' }).click();

  // 4. Redirige a /
  await page.waitForURL('/', { timeout: 10_000 });
  await gotoHome(page);

  // 5. La fila aparece con los datos
  await expect(page.getByText('iPhone 12 64GB')).toBeVisible();
  await expect(page.getByText('Juan')).toBeVisible();
  // 150 € y 250 € pueden aparecer también en el KPI "Costes" como
  // "150,00 € producto + 5,00 € asociados". Usamos .first() para
  // apuntar a la celda de la tabla.
  await expect(page.getByText(/150,00/).first()).toBeVisible();
  await expect(page.getByText(/250,00/).first()).toBeVisible();
  await expect(page.getByText('Sí')).toBeVisible();

  // 6. KPIs: Total=1, Beneficio = 250 - 150 - 5 = 95 €
  await expectTotal(page, 1);
  // getByText con el formatted string exacto (incluye NBSP).
  await expectNetProfit(page, 9500);
});