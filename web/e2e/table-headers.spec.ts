import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

interface Metrics {
  lines: number;

  textTop: number | null;

  indicatorY: number | null;

  offset: number | null;

  truncated: boolean;
}

async function measureHeader(
  page: import('@playwright/test').Page,
  column: string,
): Promise<Metrics> {
  const header = page.getByRole('columnheader', { name: new RegExp(column) });
  await expect(header).toBeVisible();
  return header.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode as Text);

    const textNode =
      texts.find((t) => t.textContent?.trim().startsWith('Asociados')) ??
      texts.find((t) => t.textContent?.trim().startsWith('Precio de venta')) ??
      texts.find((t) => t.textContent?.trim());
    const indicatorNode = texts.find(
      (t) => t.textContent?.includes('▼') || t.textContent?.includes('▲'),
    );

    const textRange = document.createRange();
    if (textNode) textRange.selectNodeContents(textNode);
    const rects = textNode ? Array.from(textRange.getClientRects()) : [];

    const indicatorRange = document.createRange();
    if (indicatorNode) indicatorRange.selectNodeContents(indicatorNode);
    const indicatorRect = indicatorNode ? indicatorRange.getBoundingClientRect() : null;

    const parent = textNode?.parentElement ?? null;
    const truncated = parent ? parent.scrollWidth > parent.clientWidth + 1 : false;

    const textTop = rects.length ? rects[0]!.y : null;
    const indicatorY = indicatorRect ? indicatorRect.y : null;

    return {
      lines: rects.length,
      textTop,
      indicatorY,
      offset: textTop !== null && indicatorY !== null ? Math.abs(indicatorY - textTop) : null,
      truncated,
    };
  });
}

async function firstHeaderWidth(page: import('@playwright/test').Page): Promise<number> {
  const box = await page.locator('thead th').first().boundingBox();
  return box?.width ?? 0;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('el indicador de orden se queda en la misma línea que la cabecera', async ({
  page,
  request,
}) => {
  const buy = await request.post('/api/buys', {
    data: {
      product_name: 'Funda iPhone',
      purchase_cost: 100,
      quantity: 20,
      associated_costs: 5,
    },
  });
  const buyBody = (await buy.json()) as { data: { id: number } };
  const cust = await request.post('/api/customers', { data: { name: 'Juan' } });
  const custBody = (await cust.json()) as { data: { id: number } };
  await request.post('/api/solds', {
    data: {
      customer_id: custBody.data.id,
      sale_price: 40,
      associated_costs: 5,
      items: [{ buy_id: buyBody.data.id, quantity: 5 }],
    },
  });

  const tables: Array<{ url: string; column: string }> = [
    { url: '/solds', column: 'Asociados' },
    { url: '/buys', column: 'Asociados' },
    { url: '/products', column: 'Precio de venta' },
  ];

  for (const { url, column } of tables) {
    await page.goto(url);
    const header = page.getByRole('columnheader', { name: new RegExp(column) });
    await expect(header).toBeVisible();

    const anchoAntes = await firstHeaderWidth(page);

    await header.click();
    await expect(header).toHaveAttribute('aria-sort', /ascending|descending/);

    const medidas = await measureHeader(page, column);

    expect(
      medidas.offset,
      `${url}: el indicador no está en la línea del texto`,
    ).toBeLessThanOrEqual(2);
    expect(medidas.lines, `${url}: la cabecera se partió en dos líneas`).toBe(1);
    expect(medidas.truncated, `${url}: el texto de la cabecera quedó recortado`).toBe(false);
    const anchoDespues = await firstHeaderWidth(page);
    expect(
      Math.abs(anchoDespues - anchoAntes),
      `${url}: la tabla se desajustó al ordenar`,
    ).toBeLessThanOrEqual(1);
  }
});
