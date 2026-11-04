import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

async function createCustomerWithNotes(
  request: import('@playwright/test').APIRequestContext,
  name: string,
  notes: string,
): Promise<number> {
  const res = await request.post('/api/customers', { data: { name, notes } });
  expect(res.ok(), `POST /api/customers falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('/customers: el popover de notas se ajusta al texto corto', async ({ page, request }) => {
  await createCustomerWithNotes(request, 'Cliente Nota Corta', 'Paga al contado');

  await page.goto('/customers');
  const icon = page.getByRole('img', { name: /^Notas: Paga al contado$/ });
  await icon.hover();

  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText('Paga al contado');

  const box = await tooltip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThan(280);
  expect(box!.width).toBeGreaterThanOrEqual(80);
});

test('/customers: el popover de notas envuelve el texto largo en varias líneas', async ({
  page,
  request,
}) => {
  const longToken = 'REFERENCIAPRODUCTO1234567890'.repeat(12);
  const longText = `El cliente paga por adelantado pero viene los sábados. ${longToken}`;
  await createCustomerWithNotes(request, 'Cliente Nota Larga', longText);

  await page.goto('/customers');
  const icon = page.getByRole('img', { name: /^Notas:/ });
  await icon.hover();

  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText(longText);

  const metrics = await tooltip.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      whiteSpace: style.whiteSpace,
      overflowWrap: style.overflowWrap,
    };
  });

  expect(metrics.clientWidth).toBeLessThanOrEqual(280);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.clientHeight).toBeGreaterThan(48);
  expect(metrics.whiteSpace).toBe('pre-wrap');
  expect(metrics.overflowWrap).toBe('break-word');
});
