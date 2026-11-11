import { expect, type Page } from '@playwright/test';
import { test, clearAll } from './fixtures';

interface AnimationSample {
  hasPopOut: boolean;

  hasFadeOut: boolean;

  name: string;

  duration: string;

  mounted: boolean;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

async function installExitRecorder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store: AnimationSample[] = [];
    (window as unknown as { __exitSamples: AnimationSample[] }).__exitSamples = store;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const target = mutation.target as Element;
        if (!target.classList) continue;
        const style = getComputedStyle(target);
        store.push({
          hasPopOut: target.classList.contains('animate-pop-out'),
          hasFadeOut: target.classList.contains('animate-fade-out'),
          name: style.animationName,
          duration: style.animationDuration,
          mounted: document.body.contains(target),
        });
      }
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  });
}

async function exitSamples(page: Page): Promise<AnimationSample[]> {
  return page.evaluate(
    () => (window as unknown as { __exitSamples: AnimationSample[] }).__exitSamples ?? [],
  );
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

test('/buys: el modal de compra sale con una animación de escala y de abajo hacia arriba', async ({
  page,
}) => {
  await page.goto('/buys');
  await installExitRecorder(page);

  await page
    .getByRole('button', { name: /\+ Nueva compra/ })
    .first()
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);

  const samples = await exitSamples(page);
  const panel = samples.find((sample) => sample.hasPopOut);

  expect(panel).toBeDefined();
  expect(panel?.name).toBe('pop-out');
  expect(panel?.duration).toBe('0.15s');
  expect(panel?.mounted).toBe(true);

  const backdrop = samples.find((sample) => sample.hasFadeOut);

  expect(backdrop).toBeDefined();
  expect(backdrop?.name).toBe('fade-out');
  expect(backdrop?.duration).toBe('0.15s');
});

test('la animación pop-out va de grande a pequeño y de abajo hacia arriba', async ({ page }) => {
  await page.goto('/buys');

  const keyframes = await keyframesText(page, 'pop-out');

  expect(keyframes.length).toBeGreaterThan(0);
  expect(keyframes[0]).toContain('scale(0.92)');
  expect(keyframes[0]).toContain('translateY(10px)');
});

test('/buys: con prefers-reduced-motion la animación de salida se desactiva', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/buys');
  await installExitRecorder(page);

  await page
    .getByRole('button', { name: /\+ Nueva compra/ })
    .first()
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cerrar' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);

  const samples = await exitSamples(page);
  const panel = samples.find((sample) => sample.hasPopOut);

  expect(panel).toBeDefined();
  expect(panel?.name).toBe('none');
});

test('/buys: la confirmación inline de borrado de un tag sale con una animación de salida', async ({
  page,
  request,
}) => {
  const res = await request.post('/api/tags/buy', { data: { name: 'Urgente', color: '#dc2626' } });
  expect(res.ok(), `POST /api/tags/buy falló: ${res.status()}`).toBe(true);

  await page.goto('/buys');
  await installExitRecorder(page);

  await page.getByRole('button', { name: 'Gestionar tags' }).click();
  await page.getByRole('button', { name: 'Borrar Urgente' }).click();

  const confirmation = page.getByText('¿Estás seguro de que quieres borrar el tag «Urgente»?');
  await expect(confirmation).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar' }).click();

  await expect(confirmation).toHaveCount(0);

  const samples = await exitSamples(page);
  const block = samples.find((sample) => sample.hasPopOut);

  expect(block).toBeDefined();
  expect(block?.name).toBe('pop-out');
  expect(block?.duration).toBe('0.15s');
  expect(block?.mounted).toBe(true);
});
