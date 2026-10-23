import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

interface BuySeed {
  product_name: string;
  purchase_cost: number;
  quantity: number;
  associated_costs?: number;
  purchase_date?: string;
}

interface CustomerSeed {
  name: string;
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
  customer: CustomerSeed,
): Promise<number> {
  const res = await request.post('/api/customers', { data: customer });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('compra con cantidad 20 aparece en el ProductPickerModal con "20 disponibles"', async ({
  page,
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });
  expect(buyId).toBeGreaterThan(0);

  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Funda iPhone')).toBeVisible();
  await expect(modal.getByText(/20 disponibles/)).toBeVisible();
});

test('crear venta desde la UI: seleccionar compra, cliente, precio y submit', async ({
  page,
  request,
}) => {
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });

  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();

  const picker = page.getByRole('dialog');
  await picker.getByLabel('Funda iPhone').check();
  await picker.getByLabel('Cantidad').fill('5');
  await picker.getByRole('button', { name: /confirmar/i }).click();

  await expect(page.getByText('Funda iPhone').first()).toBeVisible();

  await page.getByLabel(/cliente/i).fill('Juan Pérez');
  const customerListbox = page.getByRole('listbox', { name: 'Clientes' });
  await expect(customerListbox).toBeVisible();
  await customerListbox.getByRole('option').first().click();

  await page.getByLabel(/precio/i).fill('40');
  await page.getByLabel(/asociados|envío|comisión/i).fill('5');
  await page.getByLabel(/notas/i).fill('Venta de prueba E2E');

  await page.getByRole('button', { name: /crear venta/i }).click();

  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  await expect(page.getByRole('cell', { name: 'Juan Pérez', exact: true })).toBeVisible();
  await expect(page.getByText(/40,00/).first()).toBeVisible();
});

test('"+ Nueva venta": cancelar el picker inicial cierra la venta (no deja el form a medias)', async ({
  page,
  request,
}) => {
  await createBuyViaApi(request, {
    product_name: 'Funda Cancelable',
    purchase_cost: 100,
    quantity: 20,
  });

  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();

  const picker = page.getByRole('dialog');
  await expect(picker.getByText('Seleccionar productos')).toBeVisible();

  await picker.getByRole('button', { name: /cancelar/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText('Productos (0)')).toBeHidden();

  const solds = await request.get('/api/solds?limit=200');
  const body = (await solds.json()) as { data: Array<{ id: number }> };
  expect(body.data).toHaveLength(0);
});

test('"+ Cambiar productos": conserva lo elegido, la cantidad se escribe fácil y cancelar vuelve al form', async ({
  page,
  request,
}) => {
  await createBuyViaApi(request, {
    product_name: 'Funda Test',
    purchase_cost: 100,
    quantity: 15,
  });

  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();

  const picker = page.getByRole('dialog');
  await picker.getByLabel('Funda Test').check();
  const qty = picker.getByLabel('Cantidad para Funda Test');
  await expect(qty).toHaveValue('1');
  await qty.click();
  await qty.press('2');
  await expect(qty).toHaveValue('2');

  await picker.getByRole('button', { name: /confirmar/i }).click();

  await expect(page.getByText('Productos (1)')).toBeVisible();
  await expect(page.getByLabel('Cantidad para Funda Test')).toHaveValue('2');

  await page.getByRole('button', { name: /\+ Cambiar productos/ }).click();
  const picker2 = page.getByRole('dialog');
  await expect(picker2.getByLabel('Seleccionar Funda Test')).toBeChecked();
  await expect(picker2.getByLabel('Cantidad para Funda Test')).toHaveValue('2');

  await picker2.getByRole('button', { name: /cancelar/i }).click();
  await expect(page.getByRole('dialog').getByText('Nueva venta')).toBeVisible();
  await expect(page.getByText('Productos (1)')).toBeVisible();
  await expect(page.getByLabel('Cantidad para Funda Test')).toHaveValue('2');
});

test('después de vender 5 unidades, la compra sigue apareciendo en /buys', async ({
  page,
  request,
}) => {
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Juan' });

  const buys = await request.get('/api/buys?limit=200');
  const body = (await buys.json()) as { data: Array<{ id: number }> };
  const buyId = body.data[0]!.id;

  const stockSale = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 40,
      associated_costs: 5,
      items: [{ buy_id: buyId, quantity: 5 }],
    },
  });
  expect(
    stockSale.ok(),
    `POST /api/solds (seed de la venta de stock) falló: ${stockSale.status()}`,
  ).toBe(true);

  await page.goto('/buys');
  await expect(page.getByText('Funda iPhone')).toBeVisible();
  const tbody = page.locator('tbody');
  await expect(tbody.getByText('20').first()).toBeVisible();
  await expect(tbody.getByText('15').first()).toBeVisible();
});

test('dashboard refleja la venta: ventas_total y beneficio coherentes', async ({
  page,
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Juan' });

  const dashboardSale = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 40,
      associated_costs: 5,
      items: [{ buy_id: buyId, quantity: 5 }],
    },
  });
  expect(
    dashboardSale.ok(),
    `POST /api/solds (seed de la venta del dashboard) falló: ${dashboardSale.status()}`,
  ).toBe(true);

  await page.goto('/');
  await expect(page.getByTestId('overview-kpis')).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText(/105,00/).first()).toBeVisible();
  await expect(page.getByText(/40,00/).first()).toBeVisible();
  await expect(page.getByText(/10,00/).first()).toBeVisible();
  await expect(page.getByText('1').first()).toBeVisible();

  await expect(page.getByTestId('cashflow-chart')).toBeVisible();
});

test('pack multi-producto: venta con 2 items de A + 1 de B', async ({ page, request }) => {
  const buyA = await createBuyViaApi(request, {
    product_name: 'Producto A',
    purchase_cost: 10,
    quantity: 5,
  });
  const buyB = await createBuyViaApi(request, {
    product_name: 'Producto B',
    purchase_cost: 6,
    quantity: 5,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Comprador Pack' });

  const packSale = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 30,
      items: [
        { buy_id: buyA, quantity: 2 },
        { buy_id: buyB, quantity: 1 },
      ],
    },
  });
  expect(
    packSale.ok(),
    `POST /api/solds (seed del pack multi-producto) falló: ${packSale.status()}`,
  ).toBe(true);

  await page.goto('/solds');
  await expect(page.getByText('Comprador Pack')).toBeVisible();
  await expect(page.getByText(/30,00/).first()).toBeVisible();

  await page.goto('/products');
  await expect(page.getByTestId('products-table')).toBeVisible({ timeout: 10_000 });
  const table = page.getByTestId('products-table');
  await expect(table.getByText('Producto A')).toBeVisible();
  await expect(table.getByText('Producto B')).toBeVisible();
});

test('error de stock insuficiente: vender más unidades de las disponibles → 422', async ({
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Cargador',
    purchase_cost: 30,
    quantity: 3,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Comprador' });

  const res = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 100,
      items: [{ buy_id: buyId, quantity: 10 }],
    },
  });

  expect(res.status()).toBe(422);
  const body = (await res.json()) as {
    error: string;
    items: Array<{ buy_id: number; product_name: string; disponibles: number; solicitado: number }>;
  };
  expect(body.error).toBe('Stock insuficiente');
  expect(body.items).toHaveLength(1);
  expect(body.items[0]).toMatchObject({
    buy_id: buyId,
    product_name: 'Cargador',
    disponibles: 3,
    solicitado: 10,
  });
});

test('crear compra desde el modal: /buys "+ Nueva compra" abre BuyNewModal', async ({ page }) => {
  await page.goto('/buys');
  await page.getByRole('button', { name: /\+ Nueva compra/ }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel('Producto *')).toBeVisible();
  await expect(modal.getByLabel('Coste (€) *')).toBeVisible();
  await expect(modal.getByLabel('Cantidad *')).toBeVisible();

  await modal.getByLabel('Producto *').fill('Funda Test');
  await modal.getByLabel('Coste (€) *').fill('50');
  await modal.getByLabel('Cantidad *').fill('3');
  await modal.getByRole('button', { name: /Crear compra/ }).click();

  await expect(modal).toBeHidden({ timeout: 5_000 });
  await expect(page.getByRole('table').getByText('Funda Test')).toBeVisible();
  await expect(page.getByText('Compra registrada')).toBeVisible();
});

test('editar compra: cambiar coste en /buys/:id refleja en la lista', async ({ page, request }) => {
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });

  const buysRes = await request.get('/api/buys');
  const buysBody = (await buysRes.json()) as { data: Array<{ id: number }> };
  const buyId = buysBody.data[0]!.id;

  await page.goto(`/buys/${buyId}`);
  await expect(page.getByRole('heading', { name: /Editar compra/ })).toBeVisible();

  const costInput = page.getByLabel('Coste (€) *');
  await expect(costInput).toHaveValue('100');
  await costInput.fill('150');
  await page.getByRole('button', { name: /Guardar cambios/ }).click();

  await expect(page).toHaveURL(/\/buys$/);
  await expect(page.getByText('150,00 €').first()).toBeVisible();
});

test('editar venta: cambiar precio en /solds/:id refleja en la lista', async ({
  page,
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Comprador Edit' });

  const soldRes = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 40,
      associated_costs: 5,
      items: [{ buy_id: buyId, quantity: 5 }],
    },
  });
  expect(
    soldRes.ok(),
    `POST /api/solds (seed de la venta a editar) falló: ${soldRes.status()}`,
  ).toBe(true);
  const soldBody = (await soldRes.json()) as { data: { id: number } };
  const soldId = soldBody.data.id;

  await page.goto(`/solds/${soldId}`);
  await expect(page.getByRole('heading', { name: /Editar venta/ })).toBeVisible();

  const priceInput = page.getByLabel(/Precio total de venta/);
  await expect(priceInput).toHaveValue('40');
  await priceInput.fill('60');
  await page.getByRole('button', { name: /Guardar cambios/ }).click();

  await expect(page).toHaveURL(/\/solds$/);
  await expect(page.getByText('60,00 €').first()).toBeVisible();
});

test('borrar compra: desde la tabla de /buys la confirmación la quita de la lista', async ({
  page,
  request,
}) => {
  await createBuyViaApi(request, {
    product_name: 'Para Borrar',
    purchase_cost: 50,
    quantity: 5,
  });

  await page.goto('/buys');
  await page.getByRole('button', { name: 'Borrar Para Borrar' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/No se puede deshacer/)).toBeVisible();
  await dialog.getByRole('button', { name: /Sí, eliminar/ }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Para Borrar')).not.toBeVisible();
});

test('borrar venta: desde la tabla de /solds la confirmación libera el stock del buy', async ({
  page,
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Con Stock',
    purchase_cost: 100,
    quantity: 10,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Comprador Delete' });
  const soldRes = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 40,
      items: [{ buy_id: buyId, quantity: 5 }],
    },
  });
  expect(
    soldRes.ok(),
    `POST /api/solds (seed de la venta a borrar) falló: ${soldRes.status()}`,
  ).toBe(true);
  const soldBody = (await soldRes.json()) as { data: { id: number } };
  const soldId = soldBody.data.id;

  await page.goto('/solds');
  await page.getByRole('button', { name: `Borrar venta #${soldId}` }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('¿Eliminar esta venta? No se puede deshacer.')).toBeVisible();
  await dialog.getByRole('button', { name: /Sí, eliminar/ }).click();

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/solds$/);
  await expect(page.getByText('Comprador Delete')).not.toBeVisible();

  await page.goto('/buys');
  const tbody = page.locator('tbody');
  await expect(tbody.getByText('10').first()).toBeVisible();
});

test('dark mode toggle persiste en reload', async ({ page }) => {
  await page.goto('/');
  const initialTheme = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  await page.getByTestId('theme-toggle').click();

  const newTheme = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  expect(newTheme).not.toBe(initialTheme);

  const storedTheme = await page.evaluate(() => window.localStorage.getItem('salemanteiner-theme'));
  expect(storedTheme).toBe(newTheme);

  await page.reload();
  const reloadedTheme = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  expect(reloadedTheme).toBe(newTheme);
});

test('tabs del dashboard navegan entre Resumen / Ingresos / Productos', async ({
  page,
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Para Dashboard',
    purchase_cost: 50,
    quantity: 3,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Cliente Dashboard' });
  const dashboardTabsSale = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 30,
      items: [{ buy_id: buyId, quantity: 1 }],
    },
  });
  expect(
    dashboardTabsSale.ok(),
    `POST /api/solds (seed de la venta de las tabs del dashboard) falló: ${dashboardTabsSale.status()}`,
  ).toBe(true);

  await page.goto('/');
  await expect(page.getByTestId('overview-kpis')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('dashboard-tab-resumen')).toBeVisible();

  await page.getByTestId('dashboard-tab-ingresos').click();
  await expect(page.getByTestId('cashflow-chart')).toBeVisible();

  await page.getByTestId('dashboard-tab-productos').click();
  await expect(page.getByTestId('products-table')).toBeVisible({ timeout: 10_000 });
});

test('borrar compra con ventas asociadas: 409 → modal de cascada → borra compra y venta', async ({
  page,
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Cascade E2E',
    purchase_cost: 50,
    quantity: 5,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Cliente Cascade' });
  const saleRes = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 100,
      items: [{ buy_id: buyId, quantity: 2 }],
    },
  });
  expect(saleRes.ok(), `POST /api/solds falló: ${saleRes.status()}`).toBe(true);
  const saleId = ((await saleRes.json()) as { data: { id: number } }).data.id;

  await page.goto('/buys');
  await page.getByRole('button', { name: 'Borrar Cascade E2E' }).click();
  await page.getByRole('button', { name: /Sí, eliminar/ }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText('La compra tiene ventas asociadas')).toBeVisible();
  await expect(dialog.getByText(`Venta #${saleId}`)).toBeVisible();
  await expect(dialog.getByText(/Cliente Cascade/)).toBeVisible();

  await page.getByRole('button', { name: 'Borrar también las ventas y la compra' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Cascade E2E')).not.toBeVisible();

  const soldsRes = await request.get('/api/solds');
  const soldsBody = (await soldsRes.json()) as { data: Array<{ id: number }> };
  expect(soldsBody.data.find((s) => s.id === saleId)).toBeUndefined();
});

test('cashflow-chart: ventas negativas (profit < 0) no rompen el render', async ({
  page,
  request,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const buyId = await createBuyViaApi(request, {
    product_name: 'Caro',
    purchase_cost: 100,
    quantity: 5,
    purchase_date: today,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Cliente Pérdida' });

  const lossSale = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 10,
      sold_at: today,
      items: [{ buy_id: buyId, quantity: 1 }],
    },
  });
  expect(
    lossSale.ok(),
    `POST /api/solds (seed de la venta con pérdida) falló: ${lossSale.status()}`,
  ).toBe(true);

  await page.goto('/');
  await expect(page.getByTestId('overview-kpis')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('cashflow-chart')).toBeVisible();

  const series = page.locator('[data-testid="cashflow-chart"] .recharts-line-curve');
  await expect(series).toHaveCount(3);

  const negativeTick = page
    .locator('[data-testid="cashflow-chart"] .recharts-yAxis-tick-labels text')
    .filter({ hasText: /^-/ });
  await expect(negativeTick.first()).toBeVisible();
});

test('la tabla entra en el viewport: la columna Acciones se ve completa (sin scroll horizontal)', async ({
  page,
  request,
}) => {
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone 15',
    purchase_cost: 45.5,
    quantity: 20,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Lucía Fernández' });
  const tableSale = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 89.9,
      items: [{ buy_id: buyId, quantity: 3 }],
    },
  });
  expect(
    tableSale.ok(),
    `POST /api/solds (seed de la venta de la tabla) falló: ${tableSale.status()}`,
  ).toBe(true);

  for (const url of ['/buys', '/solds']) {
    await page.goto(url);
    await page.locator('tbody tr').first().waitFor();

    const measurements = await page.evaluate(() => {
      const table = document.querySelector('table') as HTMLTableElement;
      const scroll = table.parentElement as HTMLElement;
      const cells = Array.from(table.querySelectorAll('tbody tr td'));
      const lastCell = cells[cells.length - 1] as HTMLElement;
      return {
        client: scroll.clientWidth,
        scrollWidth: scroll.scrollWidth,
        cellRight: Math.round(lastCell.getBoundingClientRect().right),
        containerRight: Math.round(scroll.getBoundingClientRect().right),
        cellScroll: lastCell.scrollWidth,
        cellClient: lastCell.clientWidth,
      };
    });

    expect(
      measurements.scrollWidth,
      `${url}: la tabla desborda el ancho disponible (hay scroll horizontal)`,
    ).toBeLessThanOrEqual(measurements.client);

    expect(measurements.cellRight, `${url}: la columna Acciones queda cortada`).toBeLessThanOrEqual(
      measurements.containerRight + 1,
    );

    expect(measurements.cellScroll, `${url}: el contenido de Acciones no cabe`).toBeLessThanOrEqual(
      measurements.cellClient + 1,
    );
  }
});
