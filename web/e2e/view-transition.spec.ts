/**
 * E2E: view transition de elemento compartido al editar (S3 del feature
 * `acciones-en-listas`, T7/WU4).
 *
 * Qué se quiere comprobar (y NO solo que el markup exista):
 *  1. Al pulsar "Editar", el navegador really arranca una View Transition
 *     (`document.startViewTransition` se llama).
 *  2. El elemento de origen (la celda de producto / de cliente de la fila
 *     armada) y el de destino (el input del formulario) tienen el MISMO
 *     `view-transition-name`, y ese nombre es único en el documento.
 *  3. La transición es de ELEMENTO COMPARTIDO de verdad: existen los
 *     pseudo-elementos `::view-transition-old(<nombre>)` y
 *     `::view-transition-new(<nombre>)`. Si el nombre solo estuviera en uno
 *     de los dos lados, el navegador no crearía el par old/new y la
 *     transición sería un cross-fade, no un morphing.
 *  4. Al volver a la lista, la fila del registro editado queda armada.
 *
 * Degradación: si el navegador del entorno no soporta la View Transitions
 * API (Safari < 18, Firefox < 134), el test se SALTA con el motivo, en vez
 * de fallar en falso.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { test, clearAll } from './fixtures';

/** Estado que la página guarda para poder observar las transiciones. */
interface EstadoVt {
  /** Si el navegador soporta la View Transitions API. */
  soportado: boolean;
  /** Cuántas veces se llamó a `document.startViewTransition`. */
  llamadas: number;
  /** Pseudo-elementos de la transición que se han visto en vivo. */
  pseudos: string[];
}

/**
 * Lee el estado de la instrumentación.
 *
 * Si la instrumentación no llegó a correr (la página no cargó), se devuelve
 * un estado "sin soporte": así el test se salta con el motivo en vez de
 * fallar con un error confuso.
 */
async function leerEstado(page: Page): Promise<EstadoVt> {
  return page.evaluate(() => {
    const estado = (window as unknown as { __vt?: EstadoVt }).__vt;
    return estado ?? { soportado: false, llamadas: 0, pseudos: [] };
  });
}

/**
 * Instrumenta la View Transitions API.
 *
 * - Cuenta las llamadas a `document.startViewTransition`.
 * - Acumula los pseudo-elementos (`::view-transition-old(...)`,
 *   `::view-transition-new(...)`) que existen SOLO mientras dura la
 *   animación: hay que mirarlos en vivo (de ahí el bucle de rAF).
 */
async function instrumentar(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const estado: EstadoVt = {
      soportado: typeof document.startViewTransition === 'function',
      llamadas: 0,
      pseudos: [],
    };
    (window as unknown as { __vt: EstadoVt }).__vt = estado;

    const acumular = () => {
      for (const anim of document.getAnimations()) {
        const pseudo =
          (anim.effect as (AnimationEffect & { pseudoElement?: string | null }) | null)
            ?.pseudoElement ?? null;
        if (pseudo && !estado.pseudos.includes(pseudo)) estado.pseudos.push(pseudo);
      }
      requestAnimationFrame(acumular);
    };
    requestAnimationFrame(acumular);

    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    document.startViewTransition = ((callback: () => void | Promise<void>) => {
      estado.llamadas += 1;
      return original(callback);
    }) as typeof document.startViewTransition;
  });
}

/** Reinicia los contadores (para medir solo una transición). */
async function reiniciarEstado(page: Page): Promise<void> {
  await page.evaluate(() => {
    const estado = (window as unknown as { __vt?: EstadoVt }).__vt;
    if (estado) {
      estado.llamadas = 0;
      estado.pseudos = [];
    }
  });
}

/** `view-transition-name` computado de un elemento. */
async function nombreComputado(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).viewTransitionName);
}

/** Cuántos elementos del documento tienen ese `view-transition-name`. */
async function contarConNombre(page: Page, nombre: string): Promise<number> {
  return page.evaluate((n) => {
    let total = 0;
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (getComputedStyle(el).viewTransitionName === n) total += 1;
    }
    return total;
  }, nombre);
}

/** Crea una compra vía API y devuelve su id. */
async function crearCompra(
  request: import('@playwright/test').APIRequestContext,
  product_name: string,
): Promise<number> {
  // La fecha es fija para que los tests puedan comparar el texto de la
  // celda (sin fecha, el server pone la de hoy).
  const res = await request.post('/api/buys', {
    data: { product_name, purchase_cost: 100, quantity: 20, purchase_date: '2026-10-02' },
  });
  expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

/** Crea un cliente vía API y devuelve su id. */
async function crearCliente(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.post('/api/customers', { data: { name } });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

/** Crea una venta vía API y devuelve su id. */
async function crearVenta(
  request: import('@playwright/test').APIRequestContext,
  customer_id: number,
  buy_id: number,
): Promise<number> {
  const res = await request.post('/api/solds', {
    data: { customer_id, sale_price: 40, associated_costs: 5, items: [{ buy_id, quantity: 2 }] },
  });
  expect(res.ok(), `POST /api/solds falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('editar una compra: la celda de producto viaja al input del formulario', async ({
  page,
  request,
}) => {
  const buyId = await crearCompra(request, 'Funda iPhone 15');

  await instrumentar(page);
  await page.goto('/buys');

  // Sin soporte de la API: el test se salta con el motivo (no falla en falso).
  const estadoInicial = await leerEstado(page);
  test.skip(
    !estadoInicial.soportado,
    'El navegador del entorno no soporta la View Transitions API (sin transición que comprobar)',
  );

  // 1) La fila se arma al apuntar el enlace "Editar": la celda de producto
  //    es la que lleva el `view-transition-name`.
  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();

  const nombre = `buy-product-${buyId}`;
  const celda = page.locator(`[data-vt-nombre="${nombre}"]`);
  await expect(celda).toHaveCount(1);
  await expect(celda).toHaveText('Funda iPhone 15');
  expect(await nombreComputado(celda)).toBe(nombre);
  // El nombre tiene que ser único en el documento (la tabla es virtualizada:
  // si lo llevaran dos filas, el navegador se saltaría la transición entera).
  expect(await contarConNombre(page, nombre)).toBe(1);

  // 2) Pulsar "Editar" arranca una View Transition de verdad.
  await reiniciarEstado(page);
  await editar.click();
  await expect(page).toHaveURL(new RegExp(`/buys/${buyId}$`));

  const estado = await leerEstado(page);
  expect(estado.llamadas, 'no se llamó a document.startViewTransition').toBeGreaterThan(0);

  // 3) El input del formulario es el destino: mismo nombre, único en el DOM.
  const input = page.getByLabel('Producto *');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Funda iPhone 15');
  expect(await nombreComputado(input)).toBe(nombre);
  expect(await contarConNombre(page, nombre)).toBe(1);

  // 4) La transición es de ELEMENTO COMPARTIDO: existen los pseudo-elementos
  //    old y new del mismo nombre (si solo estuviera en un lado, no habría
  //    morphing, solo un cross-fade).
  await page.waitForFunction(
    (n) =>
      ((window as unknown as { __vt: EstadoVt }).__vt.pseudos ?? []).some((p) =>
        p.includes(`old(${n})`),
      ),
    nombre,
    { timeout: 5_000 },
  );
  const pseudos = (await leerEstado(page)).pseudos;
  expect(pseudos).toContain(`::view-transition-old(${nombre})`);
  expect(pseudos).toContain(`::view-transition-new(${nombre})`);
});

test('editar una compra: también viajan el coste, la cantidad, los asociados y la fecha', async ({
  page,
  request,
}) => {
  const buyId = await crearCompra(request, 'Funda iPhone 15');

  await instrumentar(page);
  await page.goto('/buys');

  const estadoInicial = await leerEstado(page);
  test.skip(
    !estadoInicial.soportado,
    'El navegador del entorno no soporta la View Transitions API (sin transición que comprobar)',
  );

  // Cada campo editable de la fila tiene su pareja en el formulario: la
  // celda viaja como chip de texto hasta el input (ver `index.css`).
  const CAMPOS = [
    { sufijo: 'product', texto: 'Funda iPhone 15', etiqueta: 'Producto *' },
    { sufijo: 'cost', texto: '100,00 €', etiqueta: 'Coste (€) *' },
    { sufijo: 'qty', texto: '20', etiqueta: 'Cantidad *' },
    { sufijo: 'associated', texto: '0,00 €', etiqueta: 'Costes asociados (€)' },
    { sufijo: 'date', texto: '02/10/2026', etiqueta: 'Fecha de compra' },
  ];

  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();

  for (const campo of CAMPOS) {
    const nombre = `buy-${campo.sufijo}-${buyId}`;
    const celda = page.locator(`[data-vt-nombre="${nombre}"]`);
    await expect(celda).toHaveCount(1);
    await expect(celda).toHaveText(campo.texto);
    expect(await nombreComputado(celda)).toBe(nombre);
    // Cada nombre tiene que ser único en el documento (si dos filas
    // compartieran nombre, el navegador se saltaría la transición entera).
    expect(await contarConNombre(page, nombre)).toBe(1);
  }

  await editar.click();
  await expect(page).toHaveURL(new RegExp(`/buys/${buyId}$`));

  // En el formulario, cada input lleva el nombre de su celda.
  for (const campo of CAMPOS) {
    const nombre = `buy-${campo.sufijo}-${buyId}`;
    const input = page.getByLabel(campo.etiqueta);
    await expect(input).toBeVisible();
    expect(await nombreComputado(input)).toBe(nombre);
    expect(await contarConNombre(page, nombre)).toBe(1);
  }
});

test('volver a la lista desde el formulario deja armada la fila de la compra', async ({
  page,
  request,
}) => {
  const buyId = await crearCompra(request, 'Funda iPhone 15');

  await instrumentar(page);
  await page.goto('/buys');

  // Sin soporte de la API: el test se salta con el motivo (no falla en falso).
  const estadoInicial = await leerEstado(page);
  test.skip(
    !estadoInicial.soportado,
    'El navegador del entorno no soporta la View Transitions API (sin transición que comprobar)',
  );

  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();
  await editar.click();
  await expect(page).toHaveURL(new RegExp(`/buys/${buyId}$`));

  // Volver con "Cancelar": la navegación lleva el id de la fila en el
  // `state`, así que la lista la arma.
  await reiniciarEstado(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/buys$/);

  // La fila del registro editado queda armada (y es la única con el nombre).
  const nombre = `buy-product-${buyId}`;
  const celda = page.locator(`[data-vt-nombre="${nombre}"]`);
  await expect(celda).toHaveCount(1);
  await expect(celda).toHaveText('Funda iPhone 15');
  expect(await contarConNombre(page, nombre)).toBe(1);

  // Y la vuelta ALSO es una transición de elemento compartido: el input
  // del form (origen) y la celda de la fila (destino) comparten el nombre.
  await page.waitForFunction(
    (n) =>
      ((window as unknown as { __vt: EstadoVt }).__vt.pseudos ?? []).some((p) =>
        p.includes(`old(${n})`),
      ),
    nombre,
    { timeout: 5_000 },
  );
  const pseudos = (await leerEstado(page)).pseudos;
  expect(pseudos).toContain(`::view-transition-old(${nombre})`);
  expect(pseudos).toContain(`::view-transition-new(${nombre})`);
});

test('editar una venta: la celda de cliente viaja al input del cliente', async ({
  page,
  request,
}) => {
  const buyId = await crearCompra(request, 'Funda iPhone 15');
  const customerId = await crearCliente(request, 'Lucía Fernández');
  const soldId = await crearVenta(request, customerId, buyId);

  await instrumentar(page);
  await page.goto('/solds');

  const estadoInicial = await leerEstado(page);
  test.skip(
    !estadoInicial.soportado,
    'El navegador del entorno no soporta la View Transitions API (sin transición que comprobar)',
  );

  // 1) La celda de cliente de la fila armada lleva el nombre.
  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();

  const nombre = `sold-client-${soldId}`;
  const celda = page.locator(`[data-vt-nombre="${nombre}"]`);
  await expect(celda).toHaveCount(1);
  await expect(celda).toHaveText('Lucía Fernández');
  expect(await nombreComputado(celda)).toBe(nombre);
  expect(await contarConNombre(page, nombre)).toBe(1);

  // 2) La transición arranca al pulsar "Editar".
  await reiniciarEstado(page);
  await editar.click();
  await expect(page).toHaveURL(new RegExp(`/solds/${soldId}$`));

  const estado = await leerEstado(page);
  expect(estado.llamadas, 'no se llamó a document.startViewTransition').toBeGreaterThan(0);

  // 3) El input del cliente es el destino: mismo nombre, único en el DOM.
  const input = page.getByLabel('Cliente *');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Lucía Fernández');
  expect(await nombreComputado(input)).toBe(nombre);
  expect(await contarConNombre(page, nombre)).toBe(1);

  // 4) Es una transición de ELEMENTO COMPARTIDO (existen old y new).
  await page.waitForFunction(
    (n) =>
      ((window as unknown as { __vt: EstadoVt }).__vt.pseudos ?? []).some((p) =>
        p.includes(`old(${n})`),
      ),
    nombre,
    { timeout: 5_000 },
  );
  const pseudos = (await leerEstado(page)).pseudos;
  expect(pseudos).toContain(`::view-transition-old(${nombre})`);
  expect(pseudos).toContain(`::view-transition-new(${nombre})`);
});
