import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

async function keyframesText(
  page: import('@playwright/test').Page,
  name: string,
): Promise<string[]> {
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

test('/buys: el modal de compra entra con una animación de escala y de abajo hacia arriba', async ({
  page,
}) => {
  await page.goto('/buys');
  await page
    .getByRole('button', { name: /\+ Nueva compra/ })
    .first()
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const animation = await dialog.evaluate((el) => {
    const style = getComputedStyle(el);
    return { name: style.animationName, duration: style.animationDuration };
  });

  expect(animation.name).toBe('pop-in');
  expect(animation.duration).toBe('0.2s');
});

test('/buys: el fondo del modal se atenúa al aparecer', async ({ page }) => {
  await page.goto('/buys');
  await page
    .getByRole('button', { name: /\+ Nueva compra/ })
    .first()
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const animation = await dialog.evaluate((el) => {
    const style = getComputedStyle(el.parentElement as Element);
    return { name: style.animationName, duration: style.animationDuration };
  });

  expect(animation.name).toBe('fade-in');
  expect(animation.duration).toBe('0.15s');
});

test('la animación pop-in va de pequeño a grande y de abajo hacia arriba', async ({ page }) => {
  await page.goto('/buys');

  const keyframes = await keyframesText(page, 'pop-in');

  expect(keyframes.length).toBeGreaterThan(0);
  expect(keyframes[0]).toContain('scale(0.92)');
  expect(keyframes[0]).toContain('translateY(10px)');
});

test('/buys: con prefers-reduced-motion la animación se desactiva', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/buys');
  await page
    .getByRole('button', { name: /\+ Nueva compra/ })
    .first()
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const animationName = await dialog.evaluate((el) => getComputedStyle(el).animationName);

  expect(animationName).toBe('none');
});

test('/buys: la confirmación de borrado de un tag entra con animación', async ({
  page,
  request,
}) => {
  const res = await request.post('/api/tags/buy', { data: { name: 'Urgente', color: '#dc2626' } });
  expect(res.ok(), `POST /api/tags/buy falló: ${res.status()}`).toBe(true);

  await page.goto('/buys');
  await page.getByRole('button', { name: 'Gestionar tags' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.getByRole('button', { name: 'Borrar Urgente' }).click();

  const confirmation = page.getByText('¿Estás seguro de que quieres borrar el tag «Urgente»?');
  await expect(confirmation).toBeVisible();

  const animationName = await confirmation.evaluate((el) => {
    const block = el.closest('div');
    return block ? getComputedStyle(block).animationName : 'none';
  });

  expect(animationName).toBe('pop-in');
});
