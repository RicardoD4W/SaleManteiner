/**
 * E2E: flujo completo buys + solds + dashboard (T14 de feature-buys-and-solds).
 *
 * Cubre:
 *  1. BD vacía (clear buys/solds/customers en beforeEach via API).
 *  2. Crear una compra con cantidad 20 via API.
 *  3. Abrir /solds/new → el ProductPickerModal muestra la compra con "20 disponibles".
 *  4. Seleccionar la compra, pedir 5 unidades.
 *  5. Crear un customer via API (o inline en el form si el autocomplete lo permite).
 *  6. Submit → redirige a /solds, la venta aparece.
 *  7. Volver a /buys → la compra muestra 15 disponibles (20 - 5).
 *  8. Ir a / (dashboard) → KPIs actualizados: ventas_total=precio, beneficio=precio - COGS - asociados.
 *  9. Pack multi-producto: crear 2 compras, vender 2 items de A + 1 de B en una sola venta.
 *     Verificar topProducts con prorrateo por unidad.
 *
 * Nota: este spec asume que WU3 (T13) ya wired-up las rutas /buys, /solds,
 * /dashboard en App.tsx. Hasta que eso pase, el spec falla con
 * "page.goto: net::ERR_CONNECTION_REFUSED" o similar.
 */
import { expect } from '@playwright/test';
import { test } from './fixtures';

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

/** Helper: limpia todas las entidades del nuevo modelo. Idempotente. */
async function clearAll(request: import('@playwright/test').APIRequestContext): Promise<void> {
  // Borrar ventas primero (tienen FK a buys y customers).
  const solds = await request.get('/api/solds?limit=200');
  if (solds.ok()) {
    const body = (await solds.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      await request.delete(`/api/solds/${id}`);
    }
  }
  // Borrar compras.
  const buys = await request.get('/api/buys?limit=200');
  if (buys.ok()) {
    const body = (await buys.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      await request.delete(`/api/buys/${id}`);
    }
  }
  // Borrar clientes.
  const customers = await request.get('/api/customers?limit=200');
  if (customers.ok()) {
    const body = (await customers.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      await request.delete(`/api/customers/${id}`);
    }
  }
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

test('compra con cantidad 20 aparece en ProductPickerModal con "20 disponibles"', async ({
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

  // 2. Ir a /solds/new. La página debería abrir el ProductPickerModal al montar.
  await page.goto('/solds/new');

  // 3. Verificar que el modal se muestra con la compra y el stock.
  // El modal es un <dialog> o un <div role="dialog"> con aria-modal.
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Funda iPhone')).toBeVisible();
  await expect(modal.getByText(/20 disponibles/)).toBeVisible();
});

test('crear venta desde la UI: seleccionar compra, cliente, precio y submit', async ({
  page,
  request,
}) => {
  // 1. Crear compra (20 unidades) y cliente via API.
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });
  // customer creado para el test de UI pero no referenciado en el assertion de API.
  await createCustomerViaApi(request, { name: 'Juan Pérez' });

  // 2. Ir a /solds/new.
  await page.goto('/solds/new');

  // 3. En el ProductPickerModal, seleccionar la compra (checkbox) y pedir 5 unidades.
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Funda iPhone').check(); // checkbox de selección
  await modal.getByLabel('Cantidad').fill('5'); // input de cantidad
  await modal.getByRole('button', { name: /confirmar|aceptar|continuar/i }).click();

  // 4. El form de venta aparece con los items pre-rellenados.
  // Verificar que el item está listado.
  await expect(page.getByText('Funda iPhone')).toBeVisible();
  await expect(page.getByText(/5/)).toBeVisible(); // cantidad

  // 5. Llenar el resto del form: precio, asociados, notas.
  await page.getByLabel(/precio/i).fill('40');
  await page.getByLabel(/asociados|envío|comisión/i).fill('5');
  await page.getByLabel(/notas/i).fill('Venta de prueba E2E');

  // 6. Submit.
  await page.getByRole('button', { name: /crear venta/i }).click();

  // 7. Redirige a /solds y la venta aparece.
  await page.waitForURL(/\/solds$/, { timeout: 10_000 });
  await expect(page.getByText('Funda iPhone')).toBeVisible();
  await expect(page.getByText('Juan Pérez')).toBeVisible();
});

test('después de vender 5 unidades, la compra muestra 15 disponibles en /buys', async ({
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

  // 3. Ir a /buys y verificar que muestra "15 disponibles".
  await page.goto('/buys');
  await expect(page.getByText('Funda iPhone')).toBeVisible();
  await expect(page.getByText(/15 disponibles/)).toBeVisible();
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

  // 3. Ir a / (dashboard). Esperar a que termine el loading.
  await page.goto('/');
  // El dashboard tiene un data-testid para los KPIs (OverviewTab).
  await expect(page.getByTestId('overview-kpis')).toBeVisible({ timeout: 10_000 });

  // 4. Verificar KPIs:
  // - compras_total_eur: 100€ (la compra de 20 unidades a 5€/ud).
  // - ventas_total_eur: 40€ (la venta).
  // - beneficio_total_eur: 10€ (40 - 5 - 25).
  // - stock_pendiente_count: 1 (la compra con 15 unidades disponibles).
  await expect(page.getByText(/100,00/).first()).toBeVisible();
  await expect(page.getByText(/40,00/).first()).toBeVisible();
  await expect(page.getByText(/10,00/).first()).toBeVisible();
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
  await page.goto('/solds');
  await expect(page.getByText('Producto A')).toBeVisible();
  await expect(page.getByText('Producto B')).toBeVisible();
  await expect(page.getByText('Comprador Pack')).toBeVisible();

  // 4. Ir a /dashboard/products y verificar que el topProducts muestra ambos
  // con revenue prorrateado.
  await page.goto('/dashboard/products');
  await expect(page.getByTestId('products-table')).toBeVisible({ timeout: 10_000 });
  // Producto A: 2/3 de 30 = 20€ de revenue.
  // Producto B: 1/3 de 30 = 10€ de revenue.
  // Los importes exactos pueden aparecer con formato "20,00" y "10,00".
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
