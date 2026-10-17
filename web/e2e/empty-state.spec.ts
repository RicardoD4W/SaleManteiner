/**
 * E2E: estado vacío de la lista de ventas.
 *
 * Pre-condición: BD sin ventas.
 * Pasos:
 *  1. Visita `/`.
 *  2. Verifica que aparece el mensaje "No hay ventas todavía" + CTA.
 *  3. Click en el CTA "Crear la primera →" → navega a `/sales/new`.
 */
import { expect } from '@playwright/test';
import { clearAllSales, gotoHome, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await clearAllSales(request);
});

test('muestra el CTA cuando no hay ventas y navega a /sales/new', async ({ page }) => {
  await gotoHome(page);

  await expect(page.getByText('No hay ventas todavía.')).toBeVisible();

  const cta = page.getByRole('link', { name: /Crear la primera/ });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', '/sales/new');

  await cta.click();
  await expect(page).toHaveURL(/\/sales\/new$/);
  await expect(page.getByRole('heading', { name: 'Nueva venta' })).toBeVisible();
});