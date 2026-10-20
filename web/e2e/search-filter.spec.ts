/**
 * E2E del buscador/filtro de /buys y /solds.
 *
 * Cubre la gramática del buscador:
 *  - texto libre (producto / cliente), sin distinguir mayúsculas ni acentos;
 *  - cantidad ("x2" / "x3");
 *  - fecha (dd/mm/yyyy) contra "Fecha compra" (/buys) y "Fecha" (/solds);
 *  - número simple contra columnas numéricas y como substring de un nombre;
 *  - beneficio con signo ("+30", "-10") — solo /solds;
 *  - varios tokens combinados (AND);
 *  - contador de resultados, estado vacío y botón "Limpiar filtro";
 *  - reset de la paginación a la primera página al cambiar la query.
 *
 * Los e2e levantan su propio backend (puerto 4100) y su propio Vite
 * (puerto 5174), con la BD en un directorio temporal: `npm --workspace web
 * run e2e` los corre todos.
 */
import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

interface BuySeed {
  product_name: string;
  purchase_cost: number;
  quantity: number;
  associated_costs?: number;
  purchase_date?: string;
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
  name: string,
): Promise<number> {
  const res = await request.post('/api/customers', { data: { name } });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

/** Helper: crea una venta via API. */
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

// ---------------------------------------------------------------------------
// /buys
// ---------------------------------------------------------------------------

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

  // Texto libre: sin distinguir mayúsculas.
  await search.fill('iphone');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 2 compras');

  // Número como substring del nombre ("iphone 12"): 2 tokens con AND.
  await search.fill('iphone 12');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 2 compras');

  // Limpiar con el botón "x" del input → vuelve todo.
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

  // Cantidad: la columna "Cantidad" de la compra.
  await search.fill('x3');
  await expect(page.getByText('Cargador USB-C')).toBeVisible();
  await expect(page.getByText('Funda iPhone 12')).not.toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 2 compras');

  // Fecha de compra en dd/mm/yyyy.
  await search.fill('10/04/2026');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();
});

test('/buys: filtra por coste, asociados y disponibles (columnas numéricas)', async ({
  page,
  request,
}) => {
  // Compra de 50€ / 4 unidades con 5€ de asociados; se vende 1 unidad →
  // quedan 3 disponibles.
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

  // Coste (€).
  await search.fill('50');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();

  // Asociados (€).
  await search.fill('5');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();

  // Disponibles (3 = 4 compradas - 1 vendida): es el único número que
  // matchea esta fila.
  await search.fill('3');
  await expect(page.getByText('Funda iPhone 12')).toBeVisible();
  await expect(page.getByText('Cargador USB-C')).not.toBeVisible();

  // "+3" degrada a número simple: /buys no tiene columna Beneficio, así que
  // el signo no tiene columna destino.
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

  // La tabla es virtualizada: el DOM tiene la ventana visible (+overscan),
  // no las 60 filas.
  const filasEnDom = await page.locator('tbody tr').count();
  expect(filasEnDom).toBeGreaterThan(0);
  expect(filasEnDom).toBeLessThan(60);

  // Al desplazar hasta el final aparece la última fila (id DESC: la más
  // antigua, "Caja 01").
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
  // 26 compras: la tabla es virtualizada, pero el filtro se aplica sobre
  // TODAS las filas (no solo sobre las que están en el DOM).
  for (let i = 1; i <= 26; i += 1) {
    await createBuyViaApi(request, {
      product_name: `Caja ${String(i).padStart(2, '0')}`,
      purchase_cost: 100,
      quantity: 1,
    });
  }

  await page.goto('/buys');
  const search = page.getByRole('searchbox', { name: 'Buscar compras' });

  // El filtro cubre el conjunto completo: "caja 26" (texto + número) matchea
  // solo la última caja, aunque no esté en la ventana visible.
  await search.fill('caja 26');
  await expect(page.getByTestId('buys-search-count')).toHaveText('1 de 26 compras');
  await expect(page.getByText('Caja 26')).toBeVisible();
  await expect(page.getByText('Caja 01')).not.toBeVisible();

  // Query sin coincidencias → estado vacío + botón "Limpiar filtro".
  await search.fill('no-existe-este-producto');
  await expect(page.getByText('Sin resultados para «no-existe-este-producto»')).toBeVisible();
  await expect(page.getByTestId('buys-search-count')).toHaveText('0 de 26 compras');

  await page.getByRole('button', { name: 'Limpiar filtro' }).click();
  await expect(page.getByTestId('buys-search-count')).toHaveText('26 compras');
  await expect(search).toHaveValue('');
});

// ---------------------------------------------------------------------------
// /solds
// ---------------------------------------------------------------------------

test('/solds: filtra por cliente, cantidad, fecha y beneficio con signo', async ({
  page,
  request,
}) => {
  // Compra para la venta de José: 100€ / 10 unidades → COGS unitario 10€.
  // Venta: 2 unidades a 50€ → beneficio = 50 - 0 - 20 = 30€.
  const buyJose = await createBuyViaApi(request, {
    product_name: 'Funda iPhone 12',
    purchase_cost: 100,
    quantity: 10,
  });
  const customerJose = await createCustomerViaApi(request, 'Filtro Jose Perez');

  // Compra para la venta de Ana: 20€ / 1 unidad → COGS unitario 20€.
  // Venta: 1 unidad a 10€ → beneficio = 10 - 0 - 20 = -10€.
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

  // Cliente (texto libre, sin acentos: "Jose" matchea "Jose Perez").
  await search.fill('jose');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();
  await expect(page.getByTestId('solds-search-count')).toHaveText('1 de 2 ventas');

  // Cantidad de un item de la venta.
  await search.fill('x2');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();

  // Fecha de venta (columna "Fecha" = sold_at).
  await search.fill('15/03/2026');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();

  // Beneficio con signo: "+30" solo matchea la columna Beneficio.
  await search.fill('+30');
  await expect(page.getByText('Filtro Jose Perez')).toBeVisible();
  await expect(page.getByText('Filtro Ana Ruiz')).not.toBeVisible();

  await search.fill('-10');
  await expect(page.getByText('Filtro Ana Ruiz')).toBeVisible();
  await expect(page.getByText('Filtro Jose Perez')).not.toBeVisible();

  // Producto (nombre de un item).
  await search.fill('usb-c');
  await expect(page.getByText('Filtro Ana Ruiz')).toBeVisible();
  await expect(page.getByText('Filtro Jose Perez')).not.toBeVisible();

  // Combinación AND (cliente + beneficio).
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

  // Beneficio = 50,50 - 0 - (1 * 10) = 40,50€.
  await createSoldViaApi(request, {
    customer_id: customer,
    sale_price: 50.5,
    sold_at: '2026-03-15',
    items: [{ buy_id: buyId, quantity: 1 }],
  });

  await page.goto('/solds');
  const search = page.getByRole('searchbox', { name: 'Buscar ventas' });

  // Sin signo: matchea la columna Beneficio por parte entera ("40" -> 40,50).
  await search.fill('40');
  await expect(page.getByText('Filtro Beneficio')).toBeVisible();
  await expect(page.getByTestId('solds-search-count')).toHaveText('1 de 1 venta');

  // Con signo: mismo criterio, pero exige que el beneficio sea positivo.
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
