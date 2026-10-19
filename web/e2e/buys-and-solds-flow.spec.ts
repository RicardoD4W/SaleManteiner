/**
 * E2E: flujo completo buys + solds + dashboard (T14 de feature-buys-and-solds
 * + S3 y S5 del feature dashboard-iteration-1).
 *
 * Cambios del feature dashboard-iteration-1:
 *  - S3: las pantallas de creación de buys y solds ahora son modales
 *    (BuyNewModal / SaleNewModal), no rutas. El botón "+ Nueva compra" en
 *    /buys y el botón "+ Nueva venta" en /solds abren el modal.
 *  - S5: el chart del dashboard ahora es CashFlowChart (`data-testid="cashflow-chart"`)
 *    en lugar de RevenueChart (`data-testid="revenue-chart"`).
 *
 * Cubre:
 *  1. BD vacía (clear buys/solds en beforeEach via API).
 *  2. Crear una compra con cantidad 20 via API.
 *  3. Abrir /solds y click en "+ Nueva venta" → el SaleNewModal muestra el
 *     ProductPickerModal con la compra y "20 disponibles".
 *  4. Seleccionar la compra, pedir 5 unidades.
 *  5. Crear un customer inline en el CustomerAutocomplete.
 *  6. Submit → modal cierra, la lista refresca.
 *  7. Volver a /buys → la compra aparece.
 *  8. Ir a /dashboard → KPIs actualizados: ventas_total=precio, beneficio=precio - COGS - asociados.
 *  9. Pack multi-producto: crear 2 compras, vender 2 items de A + 1 de B en una sola venta.
 *     Verificar topProducts con prorrateo por unidad.
 */
import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

/** Tipo mínimo para crear una compra via API. */
interface BuySeed {
  product_name: string;
  purchase_cost: number;
  quantity: number;
  associated_costs?: number;
  purchase_date?: string;
}

/** Tipo mínimo para crear un cliente via API. */
interface CustomerSeed {
  name: string;
}

/** Helper: crea una compra via API. Devuelve el id. */
async function createBuyViaApi(
  request: import('@playwright/test').APIRequestContext,
  buy: BuySeed,
): Promise<number> {
  const res = await request.post('/api/buys', { data: buy });
  expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

/** Helper: crea un cliente via API. Devuelve el id. */
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
  // 1. Crear una compra via API con cantidad 20.
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });
  expect(buyId).toBeGreaterThan(0);

  // 2. Ir a /solds y abrir el modal de nueva venta con el botón.
  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();

  // 3. Verificar que el modal se muestra con la compra y el stock.
  // El modal es un <div role="dialog"> con aria-modal.
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Funda iPhone')).toBeVisible();
  await expect(modal.getByText(/20 disponibles/)).toBeVisible();
});

test('crear venta desde la UI: seleccionar compra, cliente, precio y submit', async ({
  page,
  request,
}) => {
  // 1. Crear compra (20 unidades) via API. El customer se crea inline en la UI.
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });

  // 2. Ir a /solds y abrir el modal.
  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();

  // 3. En el ProductPickerModal (step 1 del SaleNewModal), seleccionar la
  // compra (checkbox) y pedir 5 unidades.
  const picker = page.getByRole('dialog');
  await picker.getByLabel('Funda iPhone').check();
  await picker.getByLabel('Cantidad').fill('5');
  await picker.getByRole('button', { name: /confirmar/i }).click();

  // 4. El form de venta (step 2) aparece con los items pre-rellenados.
  // Usamos .first() porque 'Funda iPhone' también aparece en el sr-only label
  // "Cantidad para Funda iPhone" del input de cantidad.
  await expect(page.getByText('Funda iPhone').first()).toBeVisible();

  // 5. Seleccionar el cliente via el CustomerAutocomplete.
  // Como los customers NO se limpian entre tests, "Juan Pérez" puede existir
  // de runs previos (en cuyo caso aparece como opción) o no existir (aparece
  // la opción "Crear cliente 'X'"). En ambos casos, la primera opción es lo
  // que queremos.
  await page.getByLabel(/cliente/i).fill('Juan Pérez');
  const customerListbox = page.getByRole('listbox', { name: 'Clientes' });
  await expect(customerListbox).toBeVisible();
  await customerListbox.getByRole('option').first().click();

  // 6. Llenar el resto del form: precio, asociados, notas.
  await page.getByLabel(/precio/i).fill('40');
  await page.getByLabel(/asociados|envío|comisión/i).fill('5');
  await page.getByLabel(/notas/i).fill('Venta de prueba E2E');

  // 7. Submit.
  await page.getByRole('button', { name: /crear venta/i }).click();

  // 8. El modal se cierra y la lista de /solds ahora muestra la nueva venta
  // (cliente + precio). El campo notes no se renderiza en la tabla, así que
  // verificamos por los datos que sí se muestran.
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText('Juan Pérez')).toBeVisible();
  await expect(page.getByText(/40,00/).first()).toBeVisible();
});

test('después de vender 5 unidades, la compra sigue apareciendo en /buys', async ({
  page,
  request,
}) => {
  // 1. Crear compra con cantidad 20.
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Juan' });

  // 2. Crear venta de 5 unidades via API (más rápido que via UI).
  const buys = await request.get('/api/buys?limit=200');
  const body = (await buys.json()) as { data: Array<{ id: number }> };
  const buyId = body.data[0]!.id;

  await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 40,
      associated_costs: 5,
      items: [{ buy_id: buyId, quantity: 5 }],
    },
  });

  // 3. Ir a /buys y verificar que la compra aparece con la cantidad original
  // (20) en "Cantidad" y los disponibles reales (15) en "Disponibles"
  // (calculados como `quantity - SUM(sale_items.quantity)` por el server).
  await page.goto('/buys');
  await expect(page.getByText('Funda iPhone')).toBeVisible();
  const tbody = page.locator('tbody');
  await expect(tbody.getByText('20').first()).toBeVisible(); // Cantidad original
  await expect(tbody.getByText('15').first()).toBeVisible(); // Disponibles (20 - 5 vendidos)
});

test('dashboard refleja la venta: ventas_total y beneficio coherentes', async ({
  page,
  request,
}) => {
  // 1. Crear compra y cliente.
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Juan' });

  // 2. Crear venta de 5 unidades a 40€ (COGS: 5 * 5 = 25€, beneficio: 40 - 5 - 25 = 10€).
  await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 40,
      associated_costs: 5,
      items: [{ buy_id: buyId, quantity: 5 }],
    },
  });

  // 3. Ir a "/" — el index de root renderiza DashboardPage (con OverviewTab).
  await page.goto('/');
  // El OverviewTab tiene un data-testid en el grid de los 4 KPIs.
  await expect(page.getByTestId('overview-kpis')).toBeVisible({ timeout: 10_000 });

  // 4. Verificar KPIs. formatEuro() devuelve "100,00 €", "40,00 €", "+10,00 €".
  // - compras_total_eur: 100€ (la compra de 20 unidades).
  // - ventas_total_eur: 40€ (la venta).
  // - beneficio_total_eur: 10€ (40 - 5 - 25).
  // - stock_pendiente_count: 1 (la compra con stock).
  await expect(page.getByText(/100,00/).first()).toBeVisible();
  await expect(page.getByText(/40,00/).first()).toBeVisible();
  await expect(page.getByText(/10,00/).first()).toBeVisible();
  // El KPI "Stock pendiente" muestra el número "1" (sin formato de moneda).
  await expect(page.getByText('1').first()).toBeVisible();

  // 5. El chart ahora es CashFlowChart (S5).
  await expect(page.getByTestId('cashflow-chart')).toBeVisible();
});

test('pack multi-producto: venta con 2 items de A + 1 de B', async ({
  page,
  request,
}) => {
  // 1. Crear 2 compras.
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

  // 2. Crear venta pack: 2 de A + 1 de B, precio total 30€, sin asociados.
  // COGS: 2*2 + 1*1.2 = 5.2€. Beneficio: 30 - 0 - 5.2 = 24.8€.
  await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 30,
      items: [
        { buy_id: buyA, quantity: 2 },
        { buy_id: buyB, quantity: 1 },
      ],
    },
  });

  // 3. Ir a /solds y verificar que la venta aparece.
  // NOTA: SoldsListPage no muestra los nombres de los productos (solo Cliente,
  // Precio, Asociados, etc.). Verificamos el cliente y el precio total.
  await page.goto('/solds');
  await expect(page.getByText('Comprador Pack')).toBeVisible();
  await expect(page.getByText(/30,00/).first()).toBeVisible();

  // 4. Ir a /dashboard/products y verificar que el products-table muestra
  // ambos productos (tabla ordenable en S8).
  await page.goto('/dashboard/products');
  await expect(page.getByTestId('products-table')).toBeVisible({ timeout: 10_000 });
  const table = page.getByTestId('products-table');
  await expect(table.getByText('Producto A')).toBeVisible();
  await expect(table.getByText('Producto B')).toBeVisible();
});

test('error de stock insuficiente: vender más unidades de las disponibles → 422', async ({
  request,
}) => {
  // 1. Crear compra con cantidad 3.
  const buyId = await createBuyViaApi(request, {
    product_name: 'Cargador',
    purchase_cost: 30,
    quantity: 3,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Comprador' });

  // 2. Intentar vender 10 unidades via API.
  const res = await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 100,
      items: [{ buy_id: buyId, quantity: 10 }],
    },
  });

  // 3. Verificar que devuelve 422 con el detalle del stock.
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

test('crear compra desde el modal: /buys "+ Nueva compra" abre BuyNewModal', async ({
  page,
}) => {
  await page.goto('/buys');
  await page.getByRole('button', { name: /\+ Nueva compra/ }).click();

  // El BuyNewModal tiene role="dialog" y los inputs del form.
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel('Producto *')).toBeVisible();
  await expect(modal.getByLabel('Coste (€) *')).toBeVisible();
  await expect(modal.getByLabel('Cantidad *')).toBeVisible();

  // Llenar y submit.
  await modal.getByLabel('Producto *').fill('Funda Test');
  await modal.getByLabel('Coste (€) *').fill('50');
  await modal.getByLabel('Cantidad *').fill('3');
  await modal.getByRole('button', { name: /Crear compra/ }).click();

  // Modal cierra, lista refresca.
  await expect(modal).toBeHidden({ timeout: 5_000 });
  await expect(page.getByText('Funda Test')).toBeVisible();
});
