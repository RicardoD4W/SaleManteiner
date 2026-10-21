/**
 * E2E: flujo de clientes (WU4 del feature `clientes-crud`).
 *
 * Cubre la vista "Clientes" de punta a punta:
 *  1. Alta desde la UI (modal) → el cliente aparece en la lista.
 *  2. Edición (modal) → el nombre nuevo se ve en la lista.
 *  3. Borrado de un cliente SIN ventas → borrado simple con confirmación.
 *  4. Borrado de un cliente CON ventas → 409 → modal de cascada que nombra
 *     las ventas → la cascada borra el cliente, sus ventas y sus items.
 *
 * Los datos se siembran por la API (más rápido) y la interacción con la
 * UI se hace de verdad (clics, modales, foco).
 */
import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

/** Crea un cliente por la API. Devuelve su id. */
async function crearCliente(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.post('/api/customers', { data: { name } });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

/** Crea una compra por la API. Devuelve su id. */
async function crearCompra(
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

/**
 * Nombre único por corrida.
 *
 * OJO: `clearAll` NO borra clientes (no hay endpoint DELETE para ellos),
 * así que los clientes se acumulan en la BD del e2e entre corridas. Con un
 * nombre fijo, la segunda corrida encontraría varias filas iguales y el
 * locator reventaría por strict mode.
 */
function nombreUnico(prefijo: string): string {
  return `${prefijo} ${Date.now().toString(36)}`;
}

test('alta, edición y borrado de un cliente desde la UI', async ({ page }) => {
  const nombre = nombreUnico('Lucía Fernández');
  const nombreEditado = `${nombre} Núñez`;

  await page.goto('/customers');

  // 1. ALTA: el botón abre el modal, se escribe el nombre y se guarda.
  await page.getByRole('button', { name: '+ Nuevo cliente' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Nuevo cliente')).toBeVisible();
  await dialog.getByLabel('Nombre *').fill(nombre);
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  // El modal se cierra y el cliente aparece en la lista.
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: nombre, exact: true })).toBeVisible();

  // 2. EDICIÓN: el botón "Editar" abre el modal con el nombre actual.
  await page.getByRole('button', { name: `Editar ${nombre}` }).click();
  await expect(dialog.getByText('Editar cliente')).toBeVisible();
  await expect(dialog.getByLabel('Nombre *')).toHaveValue(nombre);
  await dialog.getByLabel('Nombre *').fill(nombreEditado);
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: nombreEditado, exact: true })).toBeVisible();

  // 3. BORRADO (sin ventas): confirmación y borrado.
  await page.getByRole('button', { name: `Borrar ${nombreEditado}` }).click();
  await expect(dialog.getByText('Eliminar cliente')).toBeVisible();
  await expect(dialog.getByText(/No se puede deshacer/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Sí, eliminar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: nombreEditado, exact: true })).toHaveCount(0);
});

test('borrar un cliente con ventas: 409 → modal de cascada → borra cliente y ventas', async ({
  page,
  request,
}) => {
  // Datos: un cliente con una venta.
  const nombre = nombreUnico('Marco Ruiz');
  const customerId = await crearCliente(request, nombre);
  const buyId = await crearCompra(request, {
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
  await page.getByRole('button', { name: `Borrar ${nombre}` }).click();

  // Paso 1: la confirmación simple.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Eliminar cliente')).toBeVisible();
  await dialog.getByRole('button', { name: 'Sí, eliminar' }).click();

  // Paso 2: el server responde 409 → la modal de cascada nombra la venta.
  await expect(dialog.getByText('El cliente tiene ventas asociadas')).toBeVisible();
  await expect(dialog.getByText(`Venta #${saleBody.data.id}`)).toBeVisible();
  // La fila de la venta muestra el cliente y la fecha (formato dd/MM/yyyy).
  await expect(dialog.getByText(`${nombre} · 20/10/2026`)).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Borrar también las ventas y el cliente' }),
  ).toBeVisible();

  // Confirmar la cascada: se borran el cliente y sus ventas.
  await dialog.getByRole('button', { name: 'Borrar también las ventas y el cliente' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: nombre, exact: true })).toHaveCount(0);

  // La venta también desapareció (y con ella sus items).
  const solds = await request.get('/api/solds');
  const soldsBody = (await solds.json()) as { data: Array<{ id: number }> };
  expect(soldsBody.data.some((s) => s.id === saleBody.data.id)).toBe(false);

  // Y el stock de la compra se liberó (la venta ya no está).
  await page.goto('/buys');
  await expect(page.getByText('Cargador GaN 65W')).toBeVisible();
  await expect(page.locator('tbody').getByText('10').first()).toBeVisible();
});
