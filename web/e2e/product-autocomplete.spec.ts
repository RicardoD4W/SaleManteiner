import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('el alta de compra sugiere los nombres existentes y guarda el elegido', async ({
  page,
  request,
}) => {
  const seed = await request.post('/api/buys', {
    data: { product_name: 'Funda iPhone 15', purchase_cost: 2.28, quantity: 20 },
  });
  expect(seed.ok(), `POST /api/buys (seed) falló: ${seed.status()}`).toBe(true);

  await page.goto('/buys');
  await page.getByRole('button', { name: '+ Nueva compra' }).first().click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  const productInput = modal.getByLabel('Producto *');
  await productInput.click();
  await productInput.fill('iphone');

  const option = modal.getByRole('option', { name: /Funda iPhone 15/ });
  await expect(option).toBeVisible();
  await option.click();

  await expect(productInput).toHaveValue('Funda iPhone 15');

  await modal.getByLabel('Precio unidad (€) *').fill('45.5');
  await modal.getByRole('button', { name: 'Crear compra' }).click();

  await expect(modal).toBeHidden();

  const created = await request.get('/api/buys');
  const body = (await created.json()) as { data: Array<{ product_name: string }> };
  expect(body.data.map((b) => b.product_name)).toContain('Funda iPhone 15');
});

test('la sugerencia ignora mayúsculas y acentos', async ({ page, request }) => {
  const seed = await request.post('/api/buys', {
    data: { product_name: 'Cámara réflex', purchase_cost: 16, quantity: 5 },
  });
  expect(seed.ok(), `POST /api/buys (seed) falló: ${seed.status()}`).toBe(true);

  await page.goto('/buys');
  await page.getByRole('button', { name: '+ Nueva compra' }).first().click();

  const modal = page.getByRole('dialog');
  const productInput = modal.getByLabel('Producto *');
  await productInput.click();
  await productInput.fill('camara');

  await expect(modal.getByRole('option', { name: /Cámara réflex/ })).toBeVisible();
});
