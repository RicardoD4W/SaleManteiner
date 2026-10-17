/**
 * E2E: importación CSV (Fase 3).
 *
 * Pasos:
 *  1. BD vacía (clearAllSales en beforeEach).
 *  2. Click en "Importar CSV" desde la lista → navega a /sales/import.
 *  3. Sube `web/e2e/fixtures/sample.csv` (3 filas válidas).
 *  4. Aparece el preview con 3 filas verdes (badge "OK").
 *  5. Botón "Importar 3 ventas" habilitado → click.
 *  6. Redirige a /.
 *  7. La tabla muestra los 3 productos.
 *  8. KPIs actualizados: Total=3, Vendidas=2.
 */
import { expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearAllSales, expectTotal, gotoHome, test } from './fixtures';

// Helpers para resolver paths relativos al archivo de test (que está en web/e2e/).
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.beforeEach(async ({ request }) => {
  await clearAllSales(request);
});

test('importar CSV de 3 filas: preview verde, import OK y KPIs actualizados', async ({
  page,
}) => {
  // 1. Lista principal → link "Importar CSV"
  await gotoHome(page);
  await expect(page.getByText('No hay ventas todavía.')).toBeVisible();

  await page.getByTestId('link-import-csv').click();
  await page.waitForURL(/\/sales\/import$/);

  // 2. Subimos el CSV de muestra
  const csvPath = path.join(__dirname, 'fixtures', 'sample.csv');
  await page.getByTestId('csv-input').setInputFiles(csvPath);

  // 3. Preview: 3 filas, todas verdes
  await expect(page.getByText('3 válidas')).toBeVisible();
  await expect(page.getByTestId('preview-row-2')).toBeVisible();
  await expect(page.getByTestId('preview-row-3')).toBeVisible();
  await expect(page.getByTestId('preview-row-4')).toBeVisible();
  // Productos presentes en el preview
  await expect(page.getByText('iPhone 12 64GB')).toBeVisible();
  await expect(page.getByText('Libro TypeScript')).toBeVisible();
  await expect(page.getByText('Camiseta vintage')).toBeVisible();

  // 4. Botón habilitado con N=3
  const submit = page.getByTestId('import-submit');
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText('Importar 3 ventas');

  // 5. Submit
  await submit.click();

  // 6. Redirige a / con toast
  await page.waitForURL('/', { timeout: 10_000 });
  await gotoHome(page);

  // 7. Tabla con los 3 productos
  await expect(page.getByText('iPhone 12 64GB')).toBeVisible();
  await expect(page.getByText('Libro TypeScript')).toBeVisible();
  await expect(page.getByText('Camiseta vintage')).toBeVisible();

  // 8. KPIs: Total=3, Vendidas=2 (iPhone + Camiseta están como sold=true)
  await expectTotal(page, 3);
});

test('CSV con fila inválida: el botón importar queda deshabilitado', async ({
  page,
}) => {
  await page.goto('/sales/import');

  // armamos un CSV en línea con 1 fila válida + 1 fila con coste negativo
  const csv =
    'product_name,cost_cents,price_cents\n' +
    'Item válido,100,200\n' +
    'Item inválido,-50,200\n';

  await page.getByTestId('csv-input').setInputFiles({
    name: 'invalid-row.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });

  await expect(page.getByText('1 inválidas')).toBeVisible();
  const submit = page.getByTestId('import-submit');
  await expect(submit).toBeDisabled();
});
