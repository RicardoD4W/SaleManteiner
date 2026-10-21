/**
 * Verificación VISUAL: captura las pantallas clave de la app.
 *
 * Esto NO es un test de aserciones: es el paso de "mirar la web". Deja las
 * capturas en `web/visual/shots/` para que se puedan abrir (y leer con la
 * herramienta `read`, que renderiza los PNG como imagen).
 *
 * Qué hace:
 *  1. Siembra datos realistas vía API (BD temporal, nunca la del usuario).
 *  2. Recorre las pantallas y captura cada una.
 *  3. Falla si alguna pantalla dejó un error en la consola del navegador:
 *     un error de runtime no se ve en un screenshot, pero sí lo detecta este
 *     paso.
 *
 * Uso: `npm run visual -w web`.
 */
import { expect, test, type Page } from '@playwright/test';

/** Carpeta de salida (relativa a `web/`). */
const SHOTS = 'visual/shots';

/** Errors de consola Accumulate durante el recorrido. */
const errores: string[] = [];

/** Captura una pantalla y la nombra. */
async function capturar(page: Page, nombre: string, fullPage = true): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${nombre}.png`, fullPage });
}

/** Crea un cliente y devuelve su id. */
async function crearCliente(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.post('/api/customers', { data: { name } });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

/** Crea una compra y devuelve su id. */
async function crearCompra(
  request: import('@playwright/test').APIRequestContext,
  buy: {
    product_name: string;
    purchase_cost: number;
    quantity: number;
    associated_costs?: number;
    purchase_date?: string;
  },
): Promise<number> {
  const res = await request.post('/api/buys', { data: buy });
  expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

test.beforeAll(async ({ request }) => {
  // Limpia la BD temporal (por si se reusa).
  const solds = await request.get('/api/solds?limit=200');
  if (solds.ok()) {
    const body = (await solds.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      await request.delete(`/api/solds/${id}`);
    }
  }
  const buys = await request.get('/api/buys?limit=200');
  if (buys.ok()) {
    const body = (await buys.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      await request.delete(`/api/buys/${id}`);
    }
  }

  // Datos: acentos (a propósito, para ver la codificación en pantalla),
  // un pack, una venta con poco margen y una con beneficio negativo.
  const lucia = await crearCliente(request, 'Lucía Fernández');
  const marco = await crearCliente(request, 'Marco Ruiz');

  const funda = await crearCompra(request, {
    product_name: 'Funda iPhone 15',
    purchase_cost: 45.5,
    quantity: 20,
    associated_costs: 3.2,
    purchase_date: '2026-10-02',
  });
  const cargador = await crearCompra(request, {
    product_name: 'Cargador GaN 65W',
    purchase_cost: 22,
    quantity: 10,
    associated_costs: 1.5,
    purchase_date: '2026-10-05',
  });
  const cable = await crearCompra(request, {
    product_name: 'Cable USB-C trenzado',
    purchase_cost: 8.9,
    quantity: 50,
    purchase_date: '2026-10-09',
  });
  const soporte = await crearCompra(request, {
    product_name: 'Soporte de monitor',
    purchase_cost: 60,
    quantity: 4,
    associated_costs: 5,
    purchase_date: '2026-10-11',
  });

  // Pack de 2 productos.
  await request.post('/api/solds', {
    data: {
      customer_id: lucia,
      sale_price: 89.9,
      associated_costs: 4.5,
      sold_at: '2026-10-06',
      notes: 'Pack: funda + cable',
      items: [
        { buy_id: funda, quantity: 3 },
        { buy_id: cable, quantity: 2 },
      ],
    },
  });
  // Venta con poco margen.
  await request.post('/api/solds', {
    data: {
      customer_id: marco,
      sale_price: 29.99,
      associated_costs: 2.1,
      sold_at: '2026-10-10',
      items: [{ buy_id: cargador, quantity: 1 }],
    },
  });
  // Venta con beneficio NEGATIVO (para ver el color rojo).
  await request.post('/api/solds', {
    data: {
      customer_id: marco,
      sale_price: 40,
      associated_costs: 3,
      sold_at: '2026-10-12',
      items: [{ buy_id: soporte, quantity: 1 }],
    },
  });
  // Venta del cliente con acentos (para ver el nombre en la tabla).
  await request.post('/api/solds', {
    data: {
      customer_id: lucia,
      sale_price: 19.5,
      sold_at: '2026-10-14',
      items: [{ buy_id: cable, quantity: 1 }],
    },
  });
});

test('captura las pantallas clave en light y dark', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errores.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errores.push(`[pageerror] ${err.message}`));

  // 1. Dashboard. El chart es lazy (React.lazy + Suspense): hay que esperar
  // a que el chunk cargue y el gráfico se monte, si no la captura sale con
  // el fallback "Cargando gráfico...".
  await page.goto('/');
  await page.getByTestId('overview-kpis').waitFor({ timeout: 15_000 });
  await page.getByTestId('cashflow-chart').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await capturar(page, '01-dashboard-light');

  // 2. Compras.
  await page.goto('/buys');
  await page.getByText('Funda iPhone 15').waitFor();
  await capturar(page, '02-buys-light');

  // 3. Ventas.
  await page.goto('/solds');
  await page.getByText('Lucía Fernández').first().waitFor();
  await capturar(page, '03-solds-light');

  // 4. Clientes.
  await page.goto('/customers');
  await page.getByText('Lucía Fernández').first().waitFor();
  await capturar(page, '04-clientes-light');

  // 5. Modal de nueva venta (step 1: el picker de productos).
  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();
  await page.getByRole('dialog').waitFor();
  await capturar(page, '05-modal-nueva-venta', false);
  await page.keyboard.press('Escape');

  // 6. Página de edición de una compra.
  await page.goto('/buys');
  await page.getByRole('link', { name: 'Editar' }).first().click();
  await page.getByRole('button', { name: /Guardar cambios/ }).waitFor();
  await capturar(page, '06-editar-compra');

  // 7. Dark mode (el toggle del header).
  await page.goto('/buys');
  await page
    .getByRole('button', { name: /tema|oscuro|dark|claro|light/i })
    .first()
    .click();
  await page.waitForTimeout(400);
  await capturar(page, '07-buys-dark');

  await page.goto('/solds');
  await page.getByText('Lucía Fernández').first().waitFor();
  await capturar(page, '08-solds-dark');

  await page.goto('/customers');
  await page.getByText('Lucía Fernández').first().waitFor();
  await capturar(page, '09-clientes-dark');

  // 8. Móvil.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/solds');
  await page.getByText('Lucía Fernández').first().waitFor();
  await capturar(page, '10-solds-movil');

  // Un error de runtime no se ve en una captura: este paso lo detecta.
  expect(errores, `Errores de consola: ${errores.join(' | ')}`).toEqual([]);
});
