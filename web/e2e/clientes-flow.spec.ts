import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

async function createCustomer(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.post('/api/customers', { data: { name } });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function createBuy(
  request: import('@playwright/test').APIRequestContext,
  buy: { product_name: string; purchase_cost: number; quantity: number },
): Promise<number> {
  const res = await request.post('/api/buys', { data: buy });
  expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

test('alta, edición y borrado de un cliente desde la UI', async ({ page }) => {
  const name = uniqueName('Lucía Fernández');
  const editedName = `${name} Núñez`;

  await page.goto('/customers');

  await page.getByRole('button', { name: '+ Nuevo cliente' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Nuevo cliente')).toBeVisible();
  await dialog.getByLabel('Nombre *').fill(name);
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: name, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Editar ${name}` }).click();
  await expect(dialog.getByText('Editar cliente')).toBeVisible();
  await expect(dialog.getByLabel('Nombre *')).toHaveValue(name);
  await dialog.getByLabel('Nombre *').fill(editedName);
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: editedName, exact: true })).toBeVisible();

  await page.getByRole('button', { name: `Borrar ${editedName}` }).click();
  await expect(dialog.getByText('Eliminar cliente')).toBeVisible();
  await expect(dialog.getByText(/No se puede deshacer/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Sí, eliminar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: editedName, exact: true })).toHaveCount(0);
});

test('borrar un cliente con ventas: 409 → modal de cascada → borra cliente y ventas', async ({
  page,
  request,
}) => {
  const name = uniqueName('Marco Ruiz');
  const customerId = await createCustomer(request, name);
  const buyId = await createBuy(request, {
    product_name: 'Cargador GaN 65W',
    purchase_cost: 22,
    quantity: 10,
  });
  const sale = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 29.99,
      associated_costs: 2,
      sold_at: '2026-10-20',
      items: [{ buy_id: buyId, quantity: 2 }],
    },
  });
  expect(sale.ok(), `POST /api/solds falló: ${sale.status()}`).toBe(true);
  const saleBody = (await sale.json()) as { data: { id: number } };

  await page.goto('/customers');
  await page.getByRole('button', { name: `Borrar ${name}` }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Eliminar cliente')).toBeVisible();
  await dialog.getByRole('button', { name: 'Sí, eliminar' }).click();

  await expect(dialog.getByText('El cliente tiene ventas asociadas')).toBeVisible();
  await expect(dialog.getByText(`Venta #${saleBody.data.id}`)).toBeVisible();
  await expect(dialog.getByText(`${name} · 20/10/2026`)).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Borrar también las ventas y el cliente' }),
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Borrar también las ventas y el cliente' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: name, exact: true })).toHaveCount(0);

  const solds = await request.get('/api/solds');
  const soldsBody = (await solds.json()) as { data: Array<{ id: number }> };
  expect(soldsBody.data.some((s) => s.id === saleBody.data.id)).toBe(false);

  await page.goto('/buys');
  await expect(page.getByText('Cargador GaN 65W')).toBeVisible();
  await expect(page.locator('tbody').getByText('10').first()).toBeVisible();
});
