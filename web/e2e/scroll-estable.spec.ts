import { expect, type Page } from '@playwright/test';
import { test, clearAll } from './fixtures';

interface ScrollSnapshot {
  docHeight: number;
  scrollY: number;
  clientWidth: number;
  rootOverflow: string;
}

async function snapshot(page: Page): Promise<ScrollSnapshot> {
  return page.evaluate(() => ({
    docHeight: document.documentElement.scrollHeight,
    scrollY: window.scrollY,
    clientWidth: document.documentElement.clientWidth,
    rootOverflow: document.documentElement.style.overflow,
  }));
}

async function seedBuys(request: import('@playwright/test').APIRequestContext, count: number) {
  for (let i = 0; i < count; i += 1) {
    const res = await request.post('/api/buys', {
      data: { product_name: `Producto ${i}`, purchase_cost: 100, quantity: 20 },
    });
    expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  }
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('abrir el modal de borrado no crea scroll ni mueve la página', async ({ page, request }) => {
  await seedBuys(request, 30);

  await page.goto('/buys');
  await page.waitForSelector('table');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(100);

  const before = await snapshot(page);
  expect(
    before.scrollY,
    'la lista debe estar desplazada para que la prueba signifique algo',
  ).toBeGreaterThan(0);

  await page
    .getByRole('button', { name: /^Borrar / })
    .first()
    .click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(300);

  const after = await snapshot(page);

  expect(after.docHeight, 'el modal no puede cambiar la altura del documento').toBe(
    before.docHeight,
  );
  expect(after.scrollY, 'el modal no puede mover la página').toBe(before.scrollY);
  expect(after.clientWidth, 'el modal no puede cambiar el ancho disponible').toBe(
    before.clientWidth,
  );
  expect(after.rootOverflow, 'con el modal abierto la página de fondo no se puede desplazar').toBe(
    'hidden',
  );

  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  expect(
    (await snapshot(page)).scrollY,
    'la rueda no puede mover la página con el modal abierto',
  ).toBe(before.scrollY);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const closed = await snapshot(page);
  expect(closed.rootOverflow, 'al cerrar el modal se restaura el scroll de la página').toBe('');
  expect(closed.scrollY).toBe(before.scrollY);
});

test('la raíz reserva el hueco de la barra de scroll', async ({ page }) => {
  await page.goto('/buys');

  const gutter = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollbarGutter,
  );

  expect(gutter, 'sin gutter reservado la barra de scroll desplaza el contenido al aparecer').toBe(
    'stable both-edges',
  );
});

test('el hueco reservado tiene el mismo fondo que la app', async ({ page }) => {
  await page.goto('/customers');
  await page.waitForTimeout(300);

  const read = () =>
    page.evaluate(() => {
      const layout = document.querySelector('#root > div');
      return {
        html: getComputedStyle(document.documentElement).backgroundColor,
        layout: layout ? getComputedStyle(layout).backgroundColor : 'none',
      };
    });

  const light = await read();
  expect(light.html, 'el hueco reservado no puede verse de otro color que la app').toBe(
    light.layout,
  );

  await page.evaluate(() => localStorage.setItem('salemanteiner-theme', 'dark'));
  await page.reload();
  await page.waitForTimeout(300);

  const dark = await read();
  expect(dark.html, 'en dark mode el hueco reservado no puede verse de otro color').toBe(
    dark.layout,
  );
});

test('pasar de una lista larga a una ficha corta no cambia el ancho del contenido', async ({
  page,
  request,
}) => {
  await seedBuys(request, 30);

  await page.goto('/buys');
  await page.waitForSelector('table');
  const listWidth = (await snapshot(page)).clientWidth;

  await page.getByRole('link', { name: 'Editar' }).first().click();
  await page.waitForURL(/\/buys\/\d+$/);
  await page.waitForSelector('form');
  await page.waitForTimeout(300);

  const editWidth = (await snapshot(page)).clientWidth;

  expect(editWidth, 'la ficha no puede desplazar el contenido al cambiar de ruta').toBe(listWidth);
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter),
    'la ficha corta no puede quitar el hueco reservado a la barra de scroll',
  ).toBe('stable both-edges');
});
