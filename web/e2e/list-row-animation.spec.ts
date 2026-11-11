import { expect, type Page } from '@playwright/test';
import { test, clearAll } from './fixtures';

interface RowSample {
  className: string;
  animationName: string;
  animationDuration: string;
  text: string;
  mounted: boolean;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

async function installRowRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store: RowSample[] = [];
    (window as unknown as { __rowSamples: RowSample[] }).__rowSamples = store;

    const record = (target: Element): void => {
      const style = getComputedStyle(target);
      store.push({
        className: target.getAttribute('class') ?? '',
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        text: (target.textContent ?? '').trim().slice(0, 40),
        mounted: document.body ? document.body.contains(target) : false,
      });
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of Array.from(mutation.addedNodes)) {
            if (node instanceof Element) record(node);
          }
          continue;
        }
        const target = mutation.target as Element;
        if (target.classList) record(target);
      }
    });

    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  });
}

async function rowSamples(page: Page): Promise<RowSample[]> {
  return page.evaluate(
    () => (window as unknown as { __rowSamples: RowSample[] }).__rowSamples ?? [],
  );
}

async function samplesWithClass(page: Page, className: string): Promise<RowSample[]> {
  return (await rowSamples(page)).filter((sample) => sample.className.includes(className));
}

async function keyframesText(page: Page, name: string): Promise<string[]> {
  return page.evaluate((keyframeName) => {
    const found: string[] = [];

    const walk = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSKeyframesRule && rule.name === keyframeName) {
          found.push(rule.cssText);
          continue;
        }
        if ('cssRules' in rule) {
          walk((rule as CSSGroupingRule).cssRules);
        }
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        continue;
      }
    }

    return found;
  }, name);
}

async function seedBuy(
  request: import('@playwright/test').APIRequestContext,
  productName: string,
): Promise<void> {
  const created = await request.post('/api/buys', {
    data: { product_name: productName, purchase_cost: 5, quantity: 2 },
  });
  expect(created.ok(), `POST /api/buys falló: ${created.status()}`).toBe(true);
}

test('/buys: las filas de la tabla entran con animación', async ({ page, request }) => {
  await seedBuy(request, 'Funda iPhone');

  await installRowRecorder(page);
  await page.goto('/buys');
  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone' })).toBeVisible();

  const entering = await samplesWithClass(page, 'animate-row-slide-in');

  expect(entering.length).toBeGreaterThan(0);
  expect(entering[0].animationName).toBe('row-slide-in');
  expect(entering[0].animationDuration).toBe('0.24s');
  expect(entering[0].mounted).toBe(true);
});

test('/buys: la fila de una compra borrada sale con animación y luego desaparece', async ({
  page,
  request,
}) => {
  await seedBuy(request, 'Funda iPhone');
  await seedBuy(request, 'Cargador USB-C');

  await installRowRecorder(page);
  await page.goto('/buys');

  await page.getByRole('button', { name: 'Borrar Funda iPhone' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();

  await expect
    .poll(async () => (await samplesWithClass(page, 'animate-row-slide-out')).length)
    .toBeGreaterThan(0);

  const exiting = await samplesWithClass(page, 'animate-row-slide-out');

  expect(exiting[0].animationName).toBe('row-slide-out');
  expect(exiting[0].animationDuration).toBe('0.24s');
  expect(exiting[0].mounted).toBe(true);

  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone' })).toHaveCount(0);
});

test('/buys: al borrar la última compra la fila se desvanece antes del estado vacío', async ({
  page,
  request,
}) => {
  await seedBuy(request, 'Funda iPhone');

  await installRowRecorder(page);
  await page.goto('/buys');
  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone' })).toBeVisible();

  await page.getByRole('button', { name: 'Borrar Funda iPhone' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();

  await expect
    .poll(async () => (await samplesWithClass(page, 'animate-row-slide-out')).length)
    .toBeGreaterThan(0);

  await expect(page.getByText('No hay compras todavía.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone' })).toHaveCount(0);
});

test('/buys: con prefers-reduced-motion las filas no se animan', async ({ page, request }) => {
  await seedBuy(request, 'Funda iPhone');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installRowRecorder(page);
  await page.goto('/buys');
  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone' })).toBeVisible();

  const entering = await samplesWithClass(page, 'animate-row-slide-in');

  expect(entering.length).toBeGreaterThan(0);
  expect(entering[0].animationName).toBe('none');
});

test('/buys: las filas de la tabla no deforman la rejilla de columnas', async ({
  page,
  request,
}) => {
  await seedBuy(request, 'Funda iPhone');

  await page.goto('/buys');
  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone' })).toBeVisible();

  const desalineaciones = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('thead th'));
    const cells = Array.from(document.querySelectorAll('tbody tr:first-child td'));
    return headers.map((header, index) => {
      const headerRect = header.getBoundingClientRect();
      const cellRect = cells[index]?.getBoundingClientRect();
      if (!cellRect) return Number.POSITIVE_INFINITY;
      return (
        Math.abs(headerRect.left - cellRect.left) + Math.abs(headerRect.width - cellRect.width)
      );
    });
  });

  expect(desalineaciones.length).toBeGreaterThan(0);
  for (const desalineacion of desalineaciones) {
    expect(desalineacion).toBeLessThan(1);
  }
});

test('las filas de las tablas se deslizan sin zoom y las de las listas hacen el pop de los modales', async ({
  page,
  request,
}) => {
  const tag = await request.post('/api/tags/buy', { data: { name: 'Urgente', color: '#dc2626' } });
  expect(tag.ok(), `POST /api/tags/buy falló: ${tag.status()}`).toBe(true);
  await seedBuy(request, 'Funda iPhone');

  await page.goto('/buys');
  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone' })).toBeVisible();

  const slide = await keyframesText(page, 'row-slide-in');
  const pop = await keyframesText(page, 'row-in');

  expect(slide.length).toBeGreaterThan(0);
  expect(pop.length).toBeGreaterThan(0);

  expect(slide[0]).toContain('translate: 0px 16px');
  expect(slide[0]).not.toContain('scale');

  expect(pop[0]).toContain('translate: 0px 10px');
  expect(pop[0]).toContain('scale: 0.92');

  const computed = await page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.append(probe);

    const read = (className: string) => {
      probe.className = className;
      const style = getComputedStyle(probe);
      return { duration: style.animationDuration, timing: style.animationTimingFunction };
    };

    const result = {
      popIn: read('animate-pop-in'),
      rowIn: read('animate-row-in'),
      rowOut: read('animate-row-out'),
    };

    probe.remove();
    return result;
  });

  expect(computed.rowIn.duration).toBe(computed.popIn.duration);
  expect(computed.rowIn.timing).toBe(computed.popIn.timing);
  expect(computed.rowOut.duration).toBe(computed.popIn.duration);
  expect(computed.rowOut.timing).toBe(computed.popIn.timing);
});
