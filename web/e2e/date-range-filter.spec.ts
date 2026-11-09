import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

async function createBuyViaApi(
  request: import('@playwright/test').APIRequestContext,
  buy: { product_name: string; purchase_cost: number; quantity: number; purchase_date: string },
): Promise<number> {
  const res = await request.post('/api/buys', { data: buy });
  expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function createCustomerViaApi(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.post('/api/customers', { data: { name } });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function createSoldViaApi(
  request: import('@playwright/test').APIRequestContext,
  sold: {
    customer_id: number;
    sale_price: number;
    sold_at: string;
    items: Array<{ buy_id: number; quantity: number }>;
  },
): Promise<void> {
  const res = await request.post('/api/solds', { data: sold });
  expect(res.ok(), `POST /api/solds falló: ${res.status()}`).toBe(true);
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('/buys: el filtro de fechas deja solo las compras del período', async ({ page, request }) => {
  await createBuyViaApi(request, {
    product_name: 'Funda de abril',
    purchase_cost: 2,
    quantity: 5,
    purchase_date: '2026-04-10',
  });
  await createBuyViaApi(request, {
    product_name: 'Cargador de mayo',
    purchase_cost: 4,
    quantity: 5,
    purchase_date: '2026-05-20',
  });

  await page.goto('/buys');
  await expect(page.getByText('Funda de abril')).toBeVisible();
  await expect(page.getByText('Cargador de mayo')).toBeVisible();

  const peticion = page.waitForRequest((req) => req.url().includes('to=2026-04-30'));
  await page.getByLabel('Desde').fill('2026-04-01');
  await page.getByLabel('Hasta').fill('2026-04-30');

  const url = (await peticion).url();
  expect(url).toContain('from=2026-04-01');
  expect(url).toContain('to=2026-04-30');

  await expect(page.getByText('Funda de abril')).toBeVisible();
  await expect(page.getByText('Cargador de mayo')).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitar filtro' }).click();

  await expect(page.getByText('Cargador de mayo')).toBeVisible();
});

test('/solds: el filtro de fechas deja solo las ventas del período', async ({ page, request }) => {
  const customerId = await createCustomerViaApi(request, 'Lucía Fernández');
  const buyAbril = await createBuyViaApi(request, {
    product_name: 'Funda de abril',
    purchase_cost: 2,
    quantity: 5,
    purchase_date: '2026-04-10',
  });
  const buyMayo = await createBuyViaApi(request, {
    product_name: 'Cargador de mayo',
    purchase_cost: 4,
    quantity: 5,
    purchase_date: '2026-05-20',
  });

  await createSoldViaApi(request, {
    customer_id: customerId,
    sale_price: 30,
    sold_at: '2026-04-15',
    items: [{ buy_id: buyAbril, quantity: 1 }],
  });
  await createSoldViaApi(request, {
    customer_id: customerId,
    sale_price: 40,
    sold_at: '2026-05-25',
    items: [{ buy_id: buyMayo, quantity: 1 }],
  });

  await page.goto('/solds');
  await expect(page.getByText('Funda de abril')).toBeVisible();
  await expect(page.getByText('Cargador de mayo')).toBeVisible();

  await page.getByLabel('Desde').fill('2026-04-01');
  await page.getByLabel('Hasta').fill('2026-04-30');

  await expect(page.getByText('Funda de abril')).toBeVisible();
  await expect(page.getByText('Cargador de mayo')).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitar filtro' }).click();

  await expect(page.getByText('Cargador de mayo')).toBeVisible();
});

test('/buys: sin compras en el período se avisa y se puede quitar el filtro', async ({
  page,
  request,
}) => {
  await createBuyViaApi(request, {
    product_name: 'Funda de abril',
    purchase_cost: 2,
    quantity: 5,
    purchase_date: '2026-04-10',
  });

  await page.goto('/buys');
  await page.getByLabel('Desde').fill('2026-06-01');
  await page.getByLabel('Hasta').fill('2026-06-30');

  await expect(page.getByText('No hay compras en este período.')).toBeVisible();

  await page.getByRole('button', { name: 'Quitar filtro' }).click();

  await expect(page.getByText('Funda de abril')).toBeVisible();
});
