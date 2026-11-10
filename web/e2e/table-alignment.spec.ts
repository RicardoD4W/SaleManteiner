import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

async function seed(request: import('@playwright/test').APIRequestContext): Promise<void> {
  const res = await request.post('/api/tags/buy', { data: { name: 'Urgente', color: '#dc2626' } });
  const tagId = ((await res.json()) as { data: { id: number } }).data.id;
  await request.post('/api/buys', {
    data: {
      product_name: 'Funda iPhone 15',
      purchase_cost: 45.5,
      quantity: 20,
      purchase_date: '2026-11-05',
      notes: 'Traer el cargador',
      tag_id: tagId,
    },
  });
  await request.post('/api/buys', {
    data: {
      product_name: 'Cargador USB-C',
      purchase_cost: 19.9,
      quantity: 4,
      purchase_date: '2026-11-06',
    },
  });
}

async function medirDesalineaciones(page: import('@playwright/test').Page): Promise<number[]> {
  return page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('thead th'));
    const tds = Array.from(document.querySelectorAll('tbody tr:first-child td'));
    return ths.map((th, index) => {
      const header = th.getBoundingClientRect();
      const cell = tds[index]?.getBoundingClientRect();
      if (!cell) return Number.POSITIVE_INFINITY;
      return Math.abs(header.left - cell.left) + Math.abs(header.width - cell.width);
    });
  });
}

test('/buys: cada cabecera está alineada con su propia celda', async ({ page, request }) => {
  await seed(request);

  await page.goto('/buys');
  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone 15' })).toBeVisible();

  const desalineaciones = await medirDesalineaciones(page);
  expect(desalineaciones.length).toBeGreaterThan(0);
  for (const desalineacion of desalineaciones) {
    expect(desalineacion).toBeLessThan(1);
  }
});

test('/buys: los iconos de la columna Tags están bajo su cabecera', async ({ page, request }) => {
  await seed(request);

  await page.goto('/buys');
  await expect(page.getByRole('row').filter({ hasText: 'Funda iPhone 15' })).toBeVisible();

  const centros = await page.evaluate(() => {
    const th = Array.from(document.querySelectorAll('thead th')).find(
      (element) => element.textContent?.trim() === 'Tags',
    );
    const icono = document.querySelector('[aria-label^="Tag:"]');
    if (!th || !icono) return null;
    const header = th.getBoundingClientRect();
    const tag = icono.getBoundingClientRect();
    return Math.abs((header.left + header.right) / 2 - (tag.left + tag.right) / 2);
  });

  expect(centros).not.toBeNull();
  expect(centros!).toBeLessThan(1);
});
