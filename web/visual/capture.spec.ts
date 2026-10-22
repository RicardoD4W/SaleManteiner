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

/**
 * Sufijo único por corrida.
 *
 * OJO: los clientes NO se limpian entre corridas (no hay endpoint DELETE
 * para un cliente con ventas: hay que pasar por la cascada). Sin un sufijo
 * único, la segunda corrida encontraría varias filas con el mismo nombre y
 * los locators reventarían por strict mode.
 */
const SUFIJO = Date.now().toString(36);
/** Nombre del cliente de las capturas (con ventas). */
const NOMBRE_LUCIA = `Lucía Fernández ${SUFIJO}`;
/** Nombre del segundo cliente de las capturas (también con ventas). */
const NOMBRE_MARCO = `Marco Ruiz ${SUFIJO}`;

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
  const lucia = await crearCliente(request, NOMBRE_LUCIA);
  const marco = await crearCliente(request, NOMBRE_MARCO);

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
    if (msg.type() !== 'error') return;
    // El 409 del borrado en cascada es INTENCIONAL (el server se niega a
    // borrar una compra con ventas y la UI pide confirmación): el browser
    // lo loguea como "Failed to load resource" y no es un error de la app.
    if (msg.text().includes('status of 409')) return;
    errores.push(`[console] ${msg.text()}`);
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

  // 1b. Una TAB del dashboard (Ingresos): el link "Dashboard" del header
  // tiene que seguir iluminado (antes se apagaba al entrar a una tab).
  await page.getByRole('link', { name: 'Ingresos' }).click();
  await page.waitForTimeout(600);
  await capturar(page, '01b-dashboard-tab-ingresos');

  // 2. Compras.
  await page.goto('/buys');
  await page.getByText('Funda iPhone 15').waitFor();
  await capturar(page, '02-buys-light');

  // 3. Ventas.
  await page.goto('/solds');
  await page.getByText(NOMBRE_LUCIA).first().waitFor();
  await capturar(page, '03-solds-light');

  // 4. Clientes.
  await page.goto('/customers');
  await page.getByText(NOMBRE_LUCIA).first().waitFor();
  await capturar(page, '04-clientes-light');

  // 5. Modal de nueva venta (step 1: el picker de productos).
  await page.goto('/solds');
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();
  await page.getByRole('dialog').waitFor();
  await capturar(page, '05-modal-nueva-venta', false);
  // Escape cierra el picker y deja el form de venta; otro Escape cierra el
  // form entero.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // 5b. El picker reabierto con "+ Cambiar productos": lo que ya estaba
  // marcado tiene que salir ARRIBA del todo.
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();
  await page.getByRole('dialog').waitFor();
  // Se tilda el ÚLTIMO producto de la lista (el que menos se ve).
  const checks = page.getByRole('checkbox');
  const total = await checks.count();
  await checks.nth(total - 1).check();
  await page.getByRole('button', { name: /Confirmar/ }).click();
  await page.getByRole('button', { name: /\+ Cambiar productos/ }).waitFor();
  await page.getByRole('button', { name: /\+ Cambiar productos/ }).click();
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(300);
  await capturar(page, '05b-picker-orden', false);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // 5c. El formulario de venta (step 2): se llega eligiendo un producto en
  // el picker. Es la pantalla con el cliente, el precio, las notas y el
  // "+ Cambiar productos".
  await page.getByRole('button', { name: /\+ Nueva venta/ }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Confirmar/ }).click();
  await page.getByRole('button', { name: /\+ Cambiar productos/ }).waitFor();
  await page.waitForTimeout(300);
  await capturar(page, '05c-form-nueva-venta', false);
  await page.keyboard.press('Escape');

  // 6. Modal de CONFIRMACIÓN de borrado (paso 1 del flujo nuevo): el botón
  // "Borrar" de la fila abre el diálogo de confirmación.
  await page.goto('/buys');
  await page.getByRole('button', { name: 'Borrar Funda iPhone 15' }).click();
  await page.getByRole('dialog').waitFor();
  await capturar(page, '06-modal-confirmar-borrado', false);
  await page.keyboard.press('Escape');

  // 7. Modal de CASCADA (paso 2): una compra con ventas asociadas →
  // el server responde 409 → aparece el diálogo que nombra las ventas.
  await page.goto('/buys');
  await page.getByRole('button', { name: 'Borrar Soporte de monitor' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: /Sí, eliminar/ }).click();
  await page.getByText('La compra tiene ventas asociadas').waitFor({ timeout: 10_000 });
  await capturar(page, '07-modal-cascada', false);
  // Cancelar: no se borra nada (el flujo se cierra sin tocar la BD).
  await page.keyboard.press('Escape');

  // 8. Página de edición de una compra. La view transition de elemento
  // compartido tarda un instante: sin esperar, la captura sale a medio
  // morphing (con la foto del DOM nuevo encima de la de la tabla).
  await page.goto('/buys');
  await page.getByRole('link', { name: 'Editar' }).first().click();
  await page.getByRole('button', { name: /Guardar cambios/ }).waitFor();
  await page.waitForTimeout(900);
  await capturar(page, '08-editar-compra');

  // 8b. La transición EN PLENO VUELO: los valores de la fila viajan como
  // chips de texto hasta los campos del formulario. A velocidad normal dura
  // 250 ms (no hay forma de capturarla en ese momento), así que se
  // ralentizan las animaciones 20x por CDP y se captura con los chips en el
  // aire. Es la captura que pinea el arreglo del morphing (antes el nombre
  // se estiraba hasta el ancho del input y se salía de la caja).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.05 });
  await page.goto('/buys');
  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();
  await editar.click();
  await page.waitForTimeout(1500);
  await capturar(page, '08b-transicion-en-vuelo', false);

  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  await page.waitForTimeout(600);

  // 08c. La ENTRADA de los campos: al terminar el vuelo los inputs entran
  // con un fade corto (durante el vuelo su foto está oculta porque se
  // deformaría al estirarse). Sin esto los campos aparecerían de golpe.
  // Se hace en una navegación aparte para que la línea de tiempo de la
  // transición sea limpia.
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.05 });
  await page.goto('/buys');
  const editar2 = page.getByRole('link', { name: 'Editar' }).first();
  await editar2.hover();
  await editar2.click();
  await page.waitForTimeout(5400);
  await capturar(page, '08c-entrada-campos', false);
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  await page.waitForTimeout(600);

  // 9. Dark mode (el toggle del header).
  await page.goto('/buys');
  await page
    .getByRole('button', { name: /tema|oscuro|dark|claro|light/i })
    .first()
    .click();
  await page.waitForTimeout(400);
  await capturar(page, '09-buys-dark');

  // El modal de borrado en dark mode (el fondo del diálogo tiene que
  // seguir al tema, no quedarse blanco).
  await page.getByRole('button', { name: 'Borrar Funda iPhone 15' }).click();
  await page.getByRole('dialog').waitFor();
  await capturar(page, '10-modal-borrar-dark', false);
  await page.keyboard.press('Escape');

  await page.goto('/solds');
  await page.getByText(NOMBRE_LUCIA).first().waitFor();
  await capturar(page, '11-solds-dark');

  await page.goto('/customers');
  await page.getByText(NOMBRE_LUCIA).first().waitFor();
  await capturar(page, '12-clientes-dark');

  // 10. Móvil.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/solds');
  await page.getByText(NOMBRE_LUCIA).first().waitFor();
  await capturar(page, '13-solds-movil');

  // 11. Modales de borrado de un CLIENTE: la confirmación y la cascada
  // (el cliente tiene ventas → el server responde 409).
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/customers');
  await page.getByRole('button', { name: `Borrar ${NOMBRE_LUCIA}` }).click();
  await page.getByRole('dialog').waitFor();
  await capturar(page, '14-modal-borrar-cliente', false);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: `Borrar ${NOMBRE_MARCO}` }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: /Sí, eliminar/ }).click();
  await page.getByText('El cliente tiene ventas asociadas').waitFor({ timeout: 10_000 });
  await capturar(page, '15-modal-cascada-cliente', false);
  await page.keyboard.press('Escape');

  // Un error de runtime no se ve en una captura: este paso lo detecta.
  expect(errores, `Errores de consola: ${errores.join(' | ')}`).toEqual([]);
});
