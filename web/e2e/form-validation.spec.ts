import { test, expect } from '@playwright/test';
import { clearAll } from './fixtures';

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('el form de compra avisa de los datos inválidos sin mandarlos al servidor', async ({
  page,
}) => {
  await page.goto('/buys');
  await page.getByRole('button', { name: '+ Nueva compra' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Producto *').fill('   ');
  await dialog.getByRole('button', { name: 'Crear compra' }).click();

  await expect(dialog.getByText('El producto es obligatorio')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Crear compra' })).toBeVisible();
});

test('un importe con más de 2 decimales muestra el error del schema', async ({ page }) => {
  await page.goto('/buys');
  await page.getByRole('button', { name: '+ Nueva compra' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Producto *').fill('Funda iPhone 15');
  await dialog.getByLabel('Coste (€) *').fill('10.005');
  await dialog.getByRole('button', { name: 'Crear compra' }).click();

  await expect(dialog.getByText('Máximo 2 decimales')).toBeVisible();
});

test('el nombre del cliente no puede ser solo espacios', async ({ page }) => {
  await page.goto('/customers');
  await page.getByRole('button', { name: '+ Nuevo cliente' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre *').fill('   ');
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog.getByText('El nombre es obligatorio')).toBeVisible();
});
