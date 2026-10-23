import { expect, type Locator, type Page } from '@playwright/test';
import { test, clearAll } from './fixtures';

interface VtState {
  supported: boolean;

  calls: number;

  pseudos: string[];
}

async function readState(page: Page): Promise<VtState> {
  return page.evaluate(() => {
    const state = (window as unknown as { __vt?: VtState }).__vt;
    return state ?? { supported: false, calls: 0, pseudos: [] };
  });
}

async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state: VtState = {
      supported: typeof document.startViewTransition === 'function',
      calls: 0,
      pseudos: [],
    };
    (window as unknown as { __vt: VtState }).__vt = state;

    const accumulate = () => {
      for (const anim of document.getAnimations()) {
        const pseudo =
          (anim.effect as (AnimationEffect & { pseudoElement?: string | null }) | null)
            ?.pseudoElement ?? null;
        if (pseudo && !state.pseudos.includes(pseudo)) state.pseudos.push(pseudo);
      }
      requestAnimationFrame(accumulate);
    };
    requestAnimationFrame(accumulate);

    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    document.startViewTransition = ((callback: () => void | Promise<void>) => {
      state.calls += 1;
      return original(callback);
    }) as typeof document.startViewTransition;
  });
}

async function resetState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state = (window as unknown as { __vt?: VtState }).__vt;
    if (state) {
      state.calls = 0;
      state.pseudos = [];
    }
  });
}

async function computedName(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).viewTransitionName);
}

async function countWithName(page: Page, name: string): Promise<number> {
  return page.evaluate((n) => {
    let total = 0;
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (getComputedStyle(el).viewTransitionName === n) total += 1;
    }
    return total;
  }, name);
}

async function createBuy(
  request: import('@playwright/test').APIRequestContext,
  product_name: string,
): Promise<number> {
  const res = await request.post('/api/buys', {
    data: { product_name, purchase_cost: 100, quantity: 20, purchase_date: '2026-10-02' },
  });
  expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function createCustomer(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.post('/api/customers', { data: { name } });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function createSale(
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
  const buyId = await createBuy(request, 'Funda iPhone 15');

  await instrument(page);
  await page.goto('/buys');

  const initialState = await readState(page);
  test.skip(
    !initialState.supported,
    'El navegador del entorno no soporta la View Transitions API (sin transición que comprobar)',
  );

  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();

  const name = `buy-product-${buyId}`;
  const cell = page.locator(`[data-vt-name="${name}"]`);
  await expect(cell).toHaveCount(1);
  await expect(cell).toHaveText('Funda iPhone 15');
  expect(await computedName(cell)).toBe(name);
  expect(await countWithName(page, name)).toBe(1);

  await resetState(page);
  await editar.click();
  await expect(page).toHaveURL(new RegExp(`/buys/${buyId}$`));

  const state = await readState(page);
  expect(state.calls, 'no se llamó a document.startViewTransition').toBeGreaterThan(0);

  const input = page.getByLabel('Producto *');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Funda iPhone 15');
  expect(await computedName(input)).toBe(name);
  expect(await countWithName(page, name)).toBe(1);

  await page.waitForFunction(
    (n) =>
      ((window as unknown as { __vt: VtState }).__vt.pseudos ?? []).some((p) =>
        p.includes(`old(${n})`),
      ),
    name,
    { timeout: 5_000 },
  );
  const pseudos = (await readState(page)).pseudos;
  expect(pseudos).toContain(`::view-transition-old(${name})`);
  expect(pseudos).toContain(`::view-transition-new(${name})`);
});

test('editar una compra: también viajan el coste, la cantidad, los asociados y la fecha', async ({
  page,
  request,
}) => {
  const buyId = await createBuy(request, 'Funda iPhone 15');

  await instrument(page);
  await page.goto('/buys');

  const initialState = await readState(page);
  test.skip(
    !initialState.supported,
    'El navegador del entorno no soporta la View Transitions API (sin transición que comprobar)',
  );

  const FIELDS = [
    { suffix: 'product', text: 'Funda iPhone 15', label: 'Producto *' },
    { suffix: 'cost', text: '100,00 €', label: 'Coste (€) *' },
    { suffix: 'qty', text: '20', label: 'Cantidad *' },
    { suffix: 'associated', text: '0,00 €', label: 'Costes asociados (€)' },
    { suffix: 'date', text: '02/10/2026', label: 'Fecha de compra' },
  ];

  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();

  for (const campo of FIELDS) {
    const name = `buy-${campo.suffix}-${buyId}`;
    const cell = page.locator(`[data-vt-name="${name}"]`);
    await expect(cell).toHaveCount(1);
    await expect(cell).toHaveText(campo.text);
    expect(await computedName(cell)).toBe(name);
    expect(await countWithName(page, name)).toBe(1);
  }

  await editar.click();
  await expect(page).toHaveURL(new RegExp(`/buys/${buyId}$`));

  for (const campo of FIELDS) {
    const name = `buy-${campo.suffix}-${buyId}`;
    const input = page.getByLabel(campo.label);
    await expect(input).toBeVisible();
    expect(await computedName(input)).toBe(name);
    expect(await countWithName(page, name)).toBe(1);
  }
});

test('volver a la lista desde el formulario deja armada la fila de la compra', async ({
  page,
  request,
}) => {
  const buyId = await createBuy(request, 'Funda iPhone 15');

  await instrument(page);
  await page.goto('/buys');

  const initialState = await readState(page);
  test.skip(
    !initialState.supported,
    'El navegador del entorno no soporta la View Transitions API (sin transición que comprobar)',
  );

  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();
  await editar.click();
  await expect(page).toHaveURL(new RegExp(`/buys/${buyId}$`));

  await resetState(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/buys$/);

  const name = `buy-product-${buyId}`;
  const cell = page.locator(`[data-vt-name="${name}"]`);
  await expect(cell).toHaveCount(1);
  await expect(cell).toHaveText('Funda iPhone 15');
  expect(await countWithName(page, name)).toBe(1);

  await page.waitForFunction(
    (n) =>
      ((window as unknown as { __vt: VtState }).__vt.pseudos ?? []).some((p) =>
        p.includes(`old(${n})`),
      ),
    name,
    { timeout: 5_000 },
  );
  const pseudos = (await readState(page)).pseudos;
  expect(pseudos).toContain(`::view-transition-old(${name})`);
  expect(pseudos).toContain(`::view-transition-new(${name})`);
});

test('editar una venta: la celda de cliente viaja al input del cliente', async ({
  page,
  request,
}) => {
  const buyId = await createBuy(request, 'Funda iPhone 15');
  const customerId = await createCustomer(request, 'Lucía Fernández');
  const soldId = await createSale(request, customerId, buyId);

  await instrument(page);
  await page.goto('/solds');

  const initialState = await readState(page);
  test.skip(
    !initialState.supported,
    'El navegador del entorno no soporta la View Transitions API (sin transición que comprobar)',
  );

  const editar = page.getByRole('link', { name: 'Editar' }).first();
  await editar.hover();

  const name = `sold-client-${soldId}`;
  const cell = page.locator(`[data-vt-name="${name}"]`);
  await expect(cell).toHaveCount(1);
  await expect(cell).toHaveText('Lucía Fernández');
  expect(await computedName(cell)).toBe(name);
  expect(await countWithName(page, name)).toBe(1);

  await resetState(page);
  await editar.click();
  await expect(page).toHaveURL(new RegExp(`/solds/${soldId}$`));

  const state = await readState(page);
  expect(state.calls, 'no se llamó a document.startViewTransition').toBeGreaterThan(0);

  const input = page.getByLabel('Cliente *');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Lucía Fernández');
  expect(await computedName(input)).toBe(name);
  expect(await countWithName(page, name)).toBe(1);

  await page.waitForFunction(
    (n) =>
      ((window as unknown as { __vt: VtState }).__vt.pseudos ?? []).some((p) =>
        p.includes(`old(${n})`),
      ),
    name,
    { timeout: 5_000 },
  );
  const pseudos = (await readState(page)).pseudos;
  expect(pseudos).toContain(`::view-transition-old(${name})`);
  expect(pseudos).toContain(`::view-transition-new(${name})`);
});
