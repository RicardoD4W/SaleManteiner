import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

interface BuySeed {
  product_name: string;
  purchase_cost: number;
  quantity: number;
  associated_costs?: number;
  purchase_date?: string;
}

async function createBuyViaApi(
  request: import('@playwright/test').APIRequestContext,
  buy: BuySeed,
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

test('/buys: filtra por nombre de producto y actualiza el contador', async ({ page, request }) => {
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone 12',
    purchase_cost: 50,
    quantity: 10,
    purchase_date: '2026-04-10',
  });
  await createBuyViaApi(request, {
    product_name: 'Cargador USB-C',
    purchase_cost: 30,
    quantity: 3,
    purchase_date: '2026-05-20',
  });

  await page.goto('/buys');
  const search = page.getByRole('searchbox', { name: 'Buscar compras' });
  await expect(search).toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('2 compras');

  await search.fill('iphone');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 2 compras');

  await search.fill('iphone 12');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 2 compras');

  await page.getByRole('button', { name: 'Limpiar búsqueda' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByText('Cargador USB-C')).toBeVisible();
});

test('/buys: filtra por cantidad (x3) y por fecha de compra', async ({ page, request }) => {
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone 12',
    purchase_cost: 50,
    quantity: 10,
    purchase_date: '2026-04-10',
  });
  await createBuyViaApi(request, {
    product_name: 'Cargador USB-C',
    purchase_cost: 30,
    quantity: 3,
    purchase_date: '2026-05-20',
  });

  await page.goto('/buys');
  const search = page.getByRole('searchbox', { name: 'Buscar compras' });

  await search.fill('x3');
  await expect(page.getByText('Cargador USB-C')).toBeVisible();
  await expect(page.getByText('Funda iPhone 12')).not.toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 2 compras');

  await search.fill('10/04/2026');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();
});

test('/buys: filtra por coste, asociados y disponibles (columnas numéricas)', async ({
  page,
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone 12',
    purchase_cost: 50,
    quantity: 4,
    associated_costs: 5,
    purchase_date: '2026-04-10',
  });
  const customerId = await createCustomerViaApi(request, 'Filtro Disponibles');
  await createSoldViaApi(request, {
    customer_id: customerId,
    sale_price: 20,
    sold_at: '2026-04-12',
    items: [{ buy_id: buyId, quantity: 1 }],
  });

  await createBuyViaApi(request, {
    product_name: 'Cargador USB-C',
    purchase_cost: 30,
    quantity: 7,
    purchase_date: '2026-05-20',
  });

  await page.goto('/buys');
  const search = page.getByRole('searchbox', { name: 'Buscar compras' });

  await search.fill('50');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();

  await search.fill('5');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();

  await search.fill('3');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();

  await search.fill('+3');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 2 compras');
});

test('/buys: la tabla es virtualizada (de 60 filas solo hay una ventana en el DOM)', async ({
  page,
  request,
}) => {
  for (let i = 1; i <= 60; i += 1) {
    await createBuyViaApi(request, {
      product_name: `Caja ${String(i).padStart(2, '0')}`,
      purchase_cost: 100,
      quantity: 1,
    });
  }

  await page.goto('/buys');
  await expect(page.getByTestId('buys-search-count')).toHaveText('60 compras');

  const rowsInDom = await page.locator('tbody tr').count();
  expect(rowsInDom).toBeGreaterThan(0);
  expect(rowsInDom).toBeLessThan(60);

  await page.locator('tbody').evaluate((el) => {
    const scroller = el.closest('div');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await expect(page.getByText('Caja 01')).toBeVisible();
});

test('/buys: estado vacío con "Limpiar filtro" y filtro sobre todo el conjunto', async ({
  page,
  request,
}) => {
  for (let i = 1; i <= 26; i += 1) {
    await createBuyViaApi(request, {
      product_name: `Caja ${String(i).padStart(2, '0')}`,
      purchase_cost: 100,
      quantity: 1,
    });
  }

  await page.goto('/buys');
  const search = page.getByRole('searchbox', { name: 'Buscar compras' });

  await search.fill('caja 26');
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 26 compras');
  await expect(page.getByText('Caja 26')).toBeVisible();
  await expect(page.getByText('Caja 01')).not.toBeVisible();

  await search.fill('no-existe-este-producto');
  await expect(page.getByText('Sin resultados para «no-existe-este-producto»')).toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('0 de 26 compras');

  await page.getByRole('button', { name: 'Limpiar filtro' }).click();
  await expect(page.getByTestId('buys-search-count')).toHaveText('26 compras');
  await expect(search).toHaveValue('');
});

test('/solds: filtra por cliente, cantidad, fecha y beneficio con signo', async ({
  page,
  request,
}) => {
  const buyJose = await createBuyViaApi(request, {
    product_name: 'Funda iPhone 12',
    purchase_cost: 100,
    quantity: 10,
  });
  const customerJose = await createCustomerViaApi(request, 'Filtro Jose Perez');

  const buyAna = await createBuyViaApi(request, {
    product_name: 'Cargador USB-C',
    purchase_cost: 20,
    quantity: 1,
  });
  const customerAna = await createCustomerViaApi(request, 'Filtro Ana Ruiz');

  await createSoldViaApi(request, {
    customer_id: customerJose,
    sale_price: 50,
    sold_at: '2026-03-15',
    items: [{ buy_id: buyJose, quantity: 2 }],
  });
  await createSoldViaApi(request, {
    customer_id: customerAna,
    sale_price: 10,
    sold_at: '2026-07-01',
    items: [{ buy_id: buyAna, quantity: 1 }],
  });

  await page.goto('/solds');
  const search = page.getByRole('searchbox', { name: 'Buscar ventas' });
  await expect(search).toBeVisible();
  await expect(page.getByTestId('solds-search-count')).toHaveText('2 ventas');

  await search.fill('jose');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();
  await expect(page.getByTestId('solds-search-count')).toHaveText('1 de 2 ventas');

  await search.fill('x2');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();

  await search.fill('15/03/2026');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();

  await search.fill('+30');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();

  await search.fill('-10');
  await expect(page.getByText('Filtro Ana Ruiz')).toBeVisible();
  await expect(page.getByText('Filtro Jose Perez')).not.toBeVisible();

  await search.fill('usb-c');
  await expect(page.getByText('Filtro Ana Ruiz')).toBeVisible();
  await expect(page.getByText('Filtro Jose Perez')).not.toBeVisible();

  await search.fill('jose +30');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();
  await expect(page.getByTestId('solds-search-count')).toHaveText('1 de 2 ventas');
});

test('/solds: un número simple también matchea la columna Beneficio', async ({ page, request }) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone 12',
    purchase_cost: 100,
    quantity: 10,
  });
  const customer = await createCustomerViaApi(request, 'Filtro Beneficio');

  await createSoldViaApi(request, {
    customer_id: customer,
    sale_price: 50.5,
    sold_at: '2026-03-15',
    items: [{ buy_id: buyId, quantity: 1 }],
  });

  await page.goto('/solds');
  const search = page.getByRole('searchbox', { name: 'Buscar ventas' });

  await search.fill('40');
  await expect(page.getByText('Filtro Beneficio')).toBeVisible();
  await expect(page.getByTestId('solds-search-count')).toHaveText('1 de 1 venta');

  await search.fill('+40');
  await expect(page.getByText('Filtro Beneficio')).toBeVisible();
  await expect(page.getByTestId('solds-search-count')).toHaveText('1 de 1 venta');
});

test('/solds: filtra por precio con formato español (1.234,56)', async ({ page, request }) => {
  const buy = await createBuyViaApi(request, {
    product_name: 'Funda iPhone 12',
    purchase_cost: 100,
    quantity: 10,
  });
  const customer = await createCustomerViaApi(request, 'Filtro Precio');

  await createSoldViaApi(request, {
    customer_id: customer,
    sale_price: 1234.56,
    sold_at: '2026-03-15',
    items: [{ buy_id: buy, quantity: 1 }],
  });

  await page.goto('/solds');
  const search = page.getByRole('searchbox', { name: 'Buscar ventas' });

  await search.fill('1.234,56');
  await expect(page.getByText('Filtro Precio')).toBeVisible();
  await expect(page.getByTestId('solds-search-count')).toHaveText('1 de 1 venta');

  await search.fill('1234,56');
  await expect(page.getByText('Filtro Precio')).toBeVisible();

  await search.fill('999,99');
  await expect(page.getByText('Sin resultados para «999,99»')).toBeVisible();
});
