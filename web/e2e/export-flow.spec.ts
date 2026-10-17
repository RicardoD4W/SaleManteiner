/**
 * E2E: exportación CSV (Fase 6).
 *
 * Pasos:
 *  1. BD con 2 ventas (seed con `seedSales`).
 *  2. Visita `/`.
 *  3. Click "Exportar CSV".
 *  4. Captura el `download` event de Playwright.
 *  5. Verifica:
 *     - Filename sugerido: `sales-YYYY-MM-DD.csv`.
 *     - Cuerpo empieza con BOM (`\ufeff`).
 *     - Primera línea (post-BOM) son los headers snake_case correctos.
 *     - Aparecen los 2 productos seedeados.
 *  6. Verifica también que `GET /api/sales/export` directo devuelve los headers
 *     `Content-Disposition` correctos (atajo para verificar el endpoint sin
 *     pasar por el browser).
 */
import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { clearAllSales, gotoHome, test } from './fixtures';

test.beforeEach(async ({ request, seedSales }) => {
  await clearAllSales(request);
  await seedSales([
    {
      product_name: 'iPhone 12 64GB',
      cost_cents: 15000,
      price_cents: 25000,
      associated_costs_cents: 500,
      sold: true,
    },
    {
      product_name: 'Camiseta vintage',
      cost_cents: 500,
      price_cents: 1500,
    },
  ]);
});

test('click "Exportar CSV" descarga el archivo con headers y contenido correctos', async ({
  page,
  request,
}) => {
  await gotoHome(page);
  await expect(page.getByText('iPhone 12 64GB')).toBeVisible();
  await expect(page.getByText('Camiseta vintage')).toBeVisible();

  // Disparamos click → download se inicia → capturamos el evento.
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('button-export-csv').click();
  const download = await downloadPromise;

  // Filename esperado: sales-YYYY-MM-DD.csv
  const filename = download.suggestedFilename();
  expect(filename).toMatch(/^sales-\d{4}-\d{2}-\d{2}\.csv$/);

  // Leemos el contenido. Playwright guarda el download en un path temporal.
  const tmpPath = await download.path();
  expect(tmpPath).not.toBeNull();
  const content = await readFile(tmpPath!, 'utf-8');

  // BOM al inicio
  expect(content.charCodeAt(0)).toBe(0xfeff);

  // Saltamos el BOM (\ufeff) y verificamos headers.
  const headerLine = content.slice(1).split('\r\n')[0];
  expect(headerLine).toBe(
    'product_name,buyer_name,cost_cents,price_cents,associated_costs_cents,sold,purchase_date,sold_at,notes',
  );

  // Filas de las 2 ventas seedeadas presentes.
  expect(content).toContain('iPhone 12 64GB');
  expect(content).toContain('Camiseta vintage');

  // Céntimos como enteros literales (no formato euros).
  expect(content).toContain(',15000,');
  expect(content).toContain(',25000,');
  expect(content).not.toContain('150,00 €');

  // Booleanos como 'true'/'false' lowercase.
  expect(content).toContain(',true,');

  // Además: el endpoint directo responde con Content-Disposition.
  const res = await request.get('/api/sales/export');
  expect(res.ok()).toBe(true);
  const disposition = res.headers()['content-disposition'] ?? '';
  expect(disposition).toMatch(/attachment;\s*filename="?sales-\d{4}-\d{2}-\d{2}\.csv"?/);
});
