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
  // OJO: se busca la CELDA de la tabla, no el texto suelto: el toast de
  // sileo ("Cliente registrado" con la descripción "Juan Pérez") también
  // matchea ese texto y el locator reventaba por strict mode.
  await expect(page.getByRole('cell', { name: 'Juan Pérez', exact: true })).toBeVisible();
  await expect(page.getByText(/40,00/).first()).toBeVisible();
});

test('"+ Cambiar productos": conserva lo elegido, la cantidad se escribe fácil y cancelar vuelve al form', async ({
  page,
  request,
}) => {
  // Compra con 15 unidades (el caso reportado: escribir "2" con 15
  // disponibles no debe dejar "12").
  await createBuyViaApi(request, {
    product_name: 'Funda Test',
    purchase_cost: 100,
    quantity: 15,
  });

  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();

  // 1) Elegir el producto y escribir la cantidad a 2.
  const picker = page.getByRole('dialog');
  await picker.getByLabel('Funda Test').check();
  const qty = picker.getByLabel('Cantidad para Funda Test');
  await expect(qty).toHaveValue('1');
  await qty.click();
  await qty.press('2');
  // Escribe 2, no 12: al enfocar se selecciona el contenido del input.
  await expect(qty).toHaveValue('2');

  await picker.getByRole('button', { name: /confirmar/i }).click();

  // 2) La modal de venta refleja 2 unidades (y la cantidad es editable).
  await expect(page.getByText('Productos (1)')).toBeVisible();
  await expect(page.getByLabel('Cantidad para Funda Test')).toHaveValue('2');

  // 3) Al reabrir el picker, lo elegido viene preseleccionado con su cantidad.
  await page.getByRole('button', { name: /\+ Cambiar productos/ }).click();
  const picker2 = page.getByRole('dialog');
  await expect(picker2.getByLabel('Seleccionar Funda Test')).toBeChecked();
  await expect(picker2.getByLabel('Cantidad para Funda Test')).toHaveValue('2');

  // 4) Cancelar el picker vuelve a la modal de venta conservando la info.
  await picker2.getByRole('button', { name: /cancelar/i }).click();
  // Scoped al diálogo: "Nueva venta" también es el texto del botón de la
  // página.
  await expect(page.getByRole('dialog').getByText('Nueva venta')).toBeVisible();
  await expect(page.getByText('Productos (1)')).toBeVisible();
  await expect(page.getByLabel('Cantidad para Funda Test')).toHaveValue('2');
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

  // 4. Verificar KPIs. formatEuro() devuelve "105,00 €", "40,00 €", "+10,00 €".
  // - compras_total_eur: 105€ (100€ del producto + 5€ de los asociados de la venta).
  // - ventas_total_eur: 40€ (la venta).
  // - beneficio_total_eur: 10€ (40 - 5 - 25).
  // - stock_pendiente_count: 1 (la compra con stock).
  await expect(page.getByText(/105,00/).first()).toBeVisible();
  await expect(page.getByText(/40,00/).first()).toBeVisible();
  await expect(page.getByText(/10,00/).first()).toBeVisible();
  // El KPI "Stock pendiente" muestra el número "1" (sin formato de moneda).
  await expect(page.getByText('1').first()).toBeVisible();

  // 5. El chart ahora es CashFlowChart (S5).
  await expect(page.getByTestId('cashflow-chart')).toBeVisible();
});

test('pack multi-producto: venta con 2 items de A + 1 de B', async ({ page, request }) => {
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

  // 4. Ir a /products y verificar que el products-table muestra ambos
  // productos (tabla ordenable en S8). La ruta `/dashboard/products` se
  // renombró a `/products` al quitar el prefijo `/dashboard`.
  await page.goto('/products');
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

test('crear compra desde el modal: /buys "+ Nueva compra" abre BuyNewModal', async ({ page }) => {
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
  // Scoped a la tabla: el nombre también aparece en el toast de confirmación
  // ("Compra registrada · Funda Test") y `getByText` sin scope da 2 elementos.
  await expect(page.getByRole('table').getByText('Funda Test')).toBeVisible();
  // El aviso de éxito acompaña a la alta.
  await expect(page.getByText('Compra registrada')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Tests del feature `phase-8-polish-e2e-docs` (Fase 8 — pulido + e2e + docs):
// S3-S8 agregan cobertura de flujos no testeados en el feature buys-and-solds.
// ---------------------------------------------------------------------------

test('editar compra: cambiar coste en /buys/:id refleja en la lista', async ({ page, request }) => {
  // 1. Crear compra via API con valores conocidos.
  await createBuyViaApi(request, {
    product_name: 'Funda iPhone',
    purchase_cost: 100,
    quantity: 20,
  });

  // 2. Obtener el id de la compra recién creada.
  const buysRes = await request.get('/api/buys');
  const buysBody = (await buysRes.json()) as { data: Array<{ id: number }> };
  const buyId = buysBody.data[0]!.id;

  // 3. Navegar a /buys/:id y editar el coste de 100 a 150.
  await page.goto(`/buys/${buyId}`);
  await expect(page.getByRole('heading', { name: /Editar compra/ })).toBeVisible();

  const costInput = page.getByLabel('Coste (€) *');
  await expect(costInput).toHaveValue('100');
  await costInput.fill('150');
  await page.getByRole('button', { name: /Guardar cambios/ }).click();

  // 4. Navega a /buys y verifica que el coste actualizado aparece en la fila.
  await expect(page).toHaveURL(/\/buys$/);
  await expect(page.getByText('150,00 €').first()).toBeVisible();
});

test('editar venta: cambiar precio en /solds/:id refleja en la lista', async ({
  page,
  request,
}) => {
  // 1. Crear compra + cliente + venta via API.
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
  const soldBody = (await soldRes.json()) as { data: { id: number } };
  const soldId = soldBody.data.id;

  // 2. Navegar a /solds/:id y editar el precio de 40 a 60.
  await page.goto(`/solds/${soldId}`);
  await expect(page.getByRole('heading', { name: /Editar venta/ })).toBeVisible();

  const priceInput = page.getByLabel(/Precio total de venta/);
  await expect(priceInput).toHaveValue('40');
  await priceInput.fill('60');
  await page.getByRole('button', { name: /Guardar cambios/ }).click();

  // 3. Verificar que la lista de /solds muestra el precio actualizado.
  await expect(page).toHaveURL(/\/solds$/);
  await expect(page.getByText('60,00 €').first()).toBeVisible();
});

test('borrar compra: desde la tabla de /buys la confirmación la quita de la lista', async ({
  page,
  request,
}) => {
  // 1. Crear compra via API.
  await createBuyViaApi(request, {
    product_name: 'Para Borrar',
    purchase_cost: 50,
    quantity: 5,
  });

  // 2. Ir a /buys y borrar desde la fila (el botón "Borrar" de la columna
  // "Acciones"). El nombre accesible del botón identifica el registro.
  await page.goto('/buys');
  await page.getByRole('button', { name: 'Borrar Para Borrar' }).click();

  // 3. La modal de confirmación pide la confirmación (S1: el borrado
  // siempre pasa por una modal).
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/No se puede deshacer/)).toBeVisible();
  await dialog.getByRole('button', { name: /Sí, eliminar/ }).click();

  // 4. La compra desaparece de la lista (la página se queda en /buys).
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Para Borrar')).not.toBeVisible();
});

test('borrar venta: desde la tabla de /solds la confirmación libera el stock del buy', async ({
  page,
  request,
}) => {
  // 1. Crear compra (10 unidades) + cliente + venta (5 unidades).
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
  const soldBody = (await soldRes.json()) as { data: { id: number } };
  const soldId = soldBody.data.id;

  // 2. Ir a /solds y borrar desde la fila.
  await page.goto('/solds');
  await page.getByRole('button', { name: `Borrar venta #${soldId}` }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('¿Eliminar esta venta? No se puede deshacer.')).toBeVisible();
  await dialog.getByRole('button', { name: /Sí, eliminar/ }).click();

  // 3. Verificar: /solds no muestra la venta, y /buys muestra el stock
  // completo (10 disponibles, no 5).
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/solds$/);
  await expect(page.getByText('Comprador Delete')).not.toBeVisible();

  await page.goto('/buys');
  const tbody = page.locator('tbody');
  await expect(tbody.getByText('10').first()).toBeVisible(); // Disponibles liberados
});

test('dark mode toggle persiste en reload', async ({ page }) => {
  // 1. Cargar / y leer el tema inicial desde localStorage.
  await page.goto('/');
  const initialTheme = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });

  // 2. Click en el toggle.
  await page.getByTestId('theme-toggle').click();

  // 3. Verificar que el atributo class="dark" en <html> cambió.
  const newTheme = await page.evaluate(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  expect(newTheme).not.toBe(initialTheme);

  // 4. Verificar que localStorage también cambió.
  const storedTheme = await page.evaluate(() => window.localStorage.getItem('salemanteiner-theme'));
  expect(storedTheme).toBe(newTheme);

  // 5. Reload y verificar que el tema se mantiene (persiste via localStorage
  // + el script anti-FOUC inline en index.html que aplica la clase antes del
  // primer paint).
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
  // 1. Crear compra + cliente + venta para que el dashboard tenga datos en
  // todos los tabs (OverviewTab muestra KPIs siempre; ProductsTab necesita
  // al menos 1 venta para renderizar la products-table; ver ProductsTab.tsx
  // L86 "if sortedItems.length === 0 → mensaje 'sin ventas'").
  const buyId = await createBuyViaApi(request, {
    product_name: 'Para Dashboard',
    purchase_cost: 50,
    quantity: 3,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Cliente Dashboard' });
  await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 30,
      items: [{ buy_id: buyId, quantity: 1 }],
    },
  });

  // 2. Ir a / (raíz; el dashboard vive solo en /, la ruta /dashboard se eliminó).
  await page.goto('/');
  await expect(page.getByTestId('overview-kpis')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('dashboard-tab-resumen')).toBeVisible();

  // 3. Click en "Ingresos" → debe aparecer el cash flow chart (S5 del
  // feature dashboard-iteration-1).
  await page.getByTestId('dashboard-tab-ingresos').click();
  await expect(page.getByTestId('cashflow-chart')).toBeVisible();

  // 4. Click en "Productos" → debe aparecer la products-table (S8 del
  // feature dashboard-iteration-1). Solo se renderiza cuando hay ventas
  // (sortedItems.length > 0).
  await page.getByTestId('dashboard-tab-productos').click();
  await expect(page.getByTestId('products-table')).toBeVisible({ timeout: 10_000 });
});

test('borrar compra con ventas asociadas: 409 → modal de cascada → borra compra y venta', async ({
  page,
  request,
}) => {
  // 1. Compra con 5 unidades, cliente y una venta de 2 unidades.
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

  // 2. /buys → botón "Borrar" de la fila → "Sí, eliminar". El server
  // responde 409 (no borra en silencio) y la UI abre la modal de cascada.
  await page.goto('/buys');
  await page.getByRole('button', { name: 'Borrar Cascade E2E' }).click();
  await page.getByRole('button', { name: /Sí, eliminar/ }).click();

  // 3. La modal nombra QUÉ se va a borrar (S2: el texto tiene que nombrar
  // qué se va a borrar).
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText('La compra tiene ventas asociadas')).toBeVisible();
  await expect(dialog.getByText(`Venta #${saleId}`)).toBeVisible();
  await expect(dialog.getByText(/Cliente Cascade/)).toBeVisible();

  // 4. Confirmar el borrado en cascada.
  await page.getByRole('button', { name: 'Borrar también las ventas y la compra' }).click();

  // 5. La compra ya no está en la lista (la página se queda en /buys).
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Cascade E2E')).not.toBeVisible();

  // 6. La venta asociada también se borró (cascade real, no solo la compra).
  const soldsRes = await request.get('/api/solds');
  const soldsBody = (await soldsRes.json()) as { data: Array<{ id: number }> };
  expect(soldsBody.data.find((s) => s.id === saleId)).toBeUndefined();
});

test('cashflow-chart: ventas negativas (profit < 0) no rompen el render', async ({
  page,
  request,
}) => {
  // OJO: la fecha tiene que ir explícita. El server guarda `sold_at = NULL`
  // si el cliente no la manda, y el chart agrupa por mes de `sold_at`: una
  // venta sin fecha NO entra en `cashFlowByMonth` y el caso negativo
  // nunca llega a dibujarse (esto ya pasaba con el SVG inline).
  const today = new Date().toISOString().slice(0, 10);

  // 1. Crear una compra cara (100€ / 5 unidades → COGS unitario = 20€).
  const buyId = await createBuyViaApi(request, {
    product_name: 'Caro',
    purchase_cost: 100,
    quantity: 5,
    purchase_date: today,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Cliente Pérdida' });

  // 2. Vender 1 unidad a 10€. Profit = 10 - 0 - 20 = -10€ (negativo).
  // Antes del fix, el dominio Y del CashFlowChart solo incluía >= 0,
  // así que el punto de 'ventas = -10' se renderizaba off-screen y el
  // usuario veía solo la línea de compras (que sí está dentro del rango).
  await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 10,
      sold_at: today,
      items: [{ buy_id: buyId, quantity: 1 }],
    },
  });

  // 3. Ir a / y verificar que el chart se renderiza visible (no off-screen).
  await page.goto('/');
  await expect(page.getByTestId('overview-kpis')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('cashflow-chart')).toBeVisible();

  // 4. Verificar que se dibujan las 3 series (Compras, Ventas y Beneficio
  // real). Con recharts cada serie es una curva (`.recharts-line-curve`);
  // antes (SVG inline) eran 2 `path`. Con el fix, todas se renderizan
  // dentro del área de dibujo aunque las ventas sean negativas.
  const series = page.locator('[data-testid="cashflow-chart"] .recharts-line-curve');
  await expect(series).toHaveCount(3); // compras + ventas + beneficio real

  // 5. El dominio del eje Y incluye el valor negativo: hay un tick que
  // empieza con "-".
  const negativeTick = page
    .locator('[data-testid="cashflow-chart"] .recharts-yAxis-tick-labels text')
    .filter({ hasText: /^-/ });
  await expect(negativeTick.first()).toBeVisible();
});

test('la tabla entra en el viewport: la columna Acciones se ve completa (sin scroll horizontal)', async ({
  page,
  request,
}) => {
  // Datos: una compra y una venta (para que /solds tenga filas).
  const buyId = await createBuyViaApi(request, {
    product_name: 'Funda iPhone 15',
    purchase_cost: 45.5,
    quantity: 20,
  });
  const customerId = await createCustomerViaApi(request, { name: 'Lucía Fernández' });
  await request.post('/api/solds', {
    data: {
      customer_id: customerId,
      sale_price: 89.9,
      items: [{ buy_id: buyId, quantity: 3 }],
    },
  });

  // El bug: al sumar el botón "Borrar" a la columna "Acciones", el total
  // de anchos (`minWidth` de la tabla = Σ de los `size` de las columnas)
  // pasó el ancho disponible. La tabla no se desplazaba: la columna
  // "Acciones" quedaba CORTADA ("Editar Borra").
  //
  // Por qué se mide y no se comprueba solo el texto: el síntoma es
  // puramente visual (una celda que se sale del borde del contenedor).
  for (const url of ['/buys', '/solds']) {
    await page.goto(url);
    await page.locator('tbody tr').first().waitFor();

    const medidas = await page.evaluate(() => {
      const table = document.querySelector('table') as HTMLTableElement;
      // El contenedor con scroll es el padre directo de la <table>
      // (`overflow-auto` en `VirtualTable`).
      const scroll = table.parentElement as HTMLElement;
      const celdas = Array.from(table.querySelectorAll('tbody tr td'));
      const ultima = celdas[celdas.length - 1] as HTMLElement;
      return {
        client: scroll.clientWidth,
        scrollWidth: scroll.scrollWidth,
        // Borde derecho de la última celda (la de "Acciones").
        celdaDerecha: Math.round(ultima.getBoundingClientRect().right),
        // Borde derecho del contenedor con scroll.
        contenedorDerecha: Math.round(scroll.getBoundingClientRect().right),
        // La celda de "Acciones" tiene que CABER su contenido: si no,
        // "Borrar" se sale de la celda (aunque la celda quepa).
        celdaScroll: ultima.scrollWidth,
        celdaClient: ultima.clientWidth,
      };
    });

    // 1) La tabla NO desborda el contenedor (no hay scroll horizontal).
    expect(
      medidas.scrollWidth,
      `${url}: la tabla desborda el ancho disponible (hay scroll horizontal)`,
    ).toBeLessThanOrEqual(medidas.client);

    // 2) La columna "Acciones" llega hasta el borde del contenedor: no
    // está cortada.
    expect(medidas.celdaDerecha, `${url}: la columna Acciones queda cortada`).toBeLessThanOrEqual(
      medidas.contenedorDerecha + 1,
    );

    // 3) Dentro de la celda cabe todo su contenido ("Editar" + "Borrar").
    expect(medidas.celdaScroll, `${url}: el contenido de Acciones no cabe`).toBeLessThanOrEqual(
      medidas.celdaClient + 1,
    );
  }
});
