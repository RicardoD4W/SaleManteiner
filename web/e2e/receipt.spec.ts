import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

async function createCustomerViaApi(
  request: import('@playwright/test').APIRequestContext,
  customer: { name: string; phone?: string; address?: string },
): Promise<number> {
  const res = await request.post('/api/customers', { data: customer });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function createBuyViaApi(
  request: import('@playwright/test').APIRequestContext,
  buy: { product_name: string; purchase_cost: number; quantity: number; purchase_date: string },
): Promise<number> {
  const res = await request.post('/api/buys', { data: buy });
  expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function createSoldViaApi(
  request: import('@playwright/test').APIRequestContext,
  sold: {
    customer_id: number;
    sale_price: number;
    associated_costs?: number;
    sold_at?: string;
    items: Array<{ buy_id: number; quantity: number }>;
  },
): Promise<void> {
  const res = await request.post('/api/solds', { data: sold });
  expect(res.ok(), `POST /api/solds falló: ${res.status()}`).toBe(true);
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('/solds: el recibo de una venta se abre desde la lista y muestra el cliente y el total', async ({
  page,
  request,
}) => {
  const customerId = await createCustomerViaApi(request, {
    name: 'Ana García',
    phone: '612345678',
    address: 'Calle Mayor 1',
  });
  const buyId = await createBuyViaApi(request, {
    product_name: 'iPhone 15',
    purchase_cost: 400,
    quantity: 2,
    purchase_date: '2026-10-01',
  });
  await createSoldViaApi(request, {
    customer_id: customerId,
    sale_price: 120,
    sold_at: '2026-10-05',
    items: [{ buy_id: buyId, quantity: 2 }],
  });

  await page.goto('/solds');
  await page
    .getByRole('link', { name: /^Recibo de la venta/ })
    .first()
    .click();

  await expect(page.getByRole('heading', { name: 'Recibo de venta' })).toBeVisible();
  await expect(page.getByText('Ana García')).toBeVisible();
  await expect(page.getByText('612 345 678')).toBeVisible();
  await expect(page.getByText('Calle Mayor 1')).toBeVisible();
  await expect(page.getByText('iPhone 15')).toBeVisible();
  await expect(page.getByText('120,00 €')).toBeVisible();
});

test('/solds: al imprimir solo sale el recibo, sin la cabecera de la app ni los botones', async ({
  page,
  request,
}) => {
  const customerId = await createCustomerViaApi(request, { name: 'Ana García' });
  const buyId = await createBuyViaApi(request, {
    product_name: 'iPhone 15',
    purchase_cost: 400,
    quantity: 2,
    purchase_date: '2026-10-01',
  });
  await createSoldViaApi(request, {
    customer_id: customerId,
    sale_price: 120,
    sold_at: '2026-10-05',
    items: [{ buy_id: buyId, quantity: 2 }],
  });

  await page.goto('/solds');
  await page
    .getByRole('link', { name: /^Recibo de la venta/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Recibo de venta' })).toBeVisible();

  await page.emulateMedia({ media: 'print' });

  await expect(page.getByRole('button', { name: 'Imprimir o guardar como PDF' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Recibo de venta' })).toBeVisible();
  await expect(page.getByText('120,00 €')).toBeVisible();
  await expect(page.getByText(/^Nº /)).toHaveCount(0);
});
