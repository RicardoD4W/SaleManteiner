import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

const TAG_NAME = 'Urgente';
const TAG_COLOR = '#dc2626';
const NEW_TAG_COLOR = '#0d9488';
const NEW_TAG_COLOR_RGB = 'rgb(13, 148, 136)';

interface BuySeed {
  product_name: string;
  purchase_cost: number;
  quantity: number;
  tag_id?: number;
}

async function createTagViaApi(
  request: import('@playwright/test').APIRequestContext,
  name: string,
  color: string,
): Promise<number> {
  const res = await request.post('/api/tags/buy', { data: { name, color } });
  expect(res.ok(), `POST /api/tags/buy falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

async function createBuyViaApi(
  request: import('@playwright/test').APIRequestContext,
  buy: BuySeed,
): Promise<number> {
  const res = await request.post('/api/buys', { data: buy });
  expect(res.ok(), `POST /api/buys falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('/buys: crear un tag en el modal gestor lo añade a la lista y al filtro', async ({ page }) => {
  await page.goto('/buys');

  await page.getByRole('button', { name: 'Gestionar tags' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Tags de compra' })).toBeVisible();

  await modal.getByLabel('Nombre del tag').fill(TAG_NAME);
  await modal.getByRole('button', { name: `Color ${TAG_COLOR}` }).click();
  await modal.getByRole('button', { name: 'Crear tag' }).click();

  await expect(modal.getByText(TAG_NAME, { exact: true })).toBeVisible();
  await expect(modal.getByText('sin compras')).toBeVisible();

  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).toBeHidden();

  const filter = page.getByRole('group', { name: 'Filtro de tags' });
  await expect(filter.getByRole('button', { name: TAG_NAME, exact: true })).toBeVisible();
});

test('/buys: etiquetar una compra muestra el icono del tag y tiñe su fila', async ({
  page,
  request,
}) => {
  await createTagViaApi(request, TAG_NAME, TAG_COLOR);
  await createBuyViaApi(request, {
    product_name: 'Funda etiquetada',
    purchase_cost: 5,
    quantity: 3,
  });

  await page.goto('/buys');
  await page.getByRole('link', { name: 'Editar Funda etiquetada' }).click();
  await expect(page).toHaveURL(/\/buys\/\d+$/);

  const tagSelect = page.getByLabel('Tag', { exact: true });
  await expect(tagSelect).toBeVisible();
  await tagSelect.selectOption({ label: TAG_NAME });
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(/\/buys$/);

  const row = page.getByRole('row').filter({ hasText: 'Funda etiquetada' });
  await expect(row.getByRole('img', { name: `Tag: ${TAG_NAME}` })).toBeVisible();
  await expect(row).toHaveClass(/tag-row-tinted/);
  await expect(row).toHaveAttribute('style', /--tag-color:\s*#dc2626/i);
});

test('/buys: el filtro de tags deja solo lo etiquetado y el chip "Sin tag" es excluyente', async ({
  page,
  request,
}) => {
  const tagId = await createTagViaApi(request, TAG_NAME, TAG_COLOR);
  await createBuyViaApi(request, {
    product_name: 'Funda con etiqueta',
    purchase_cost: 5,
    quantity: 3,
    tag_id: tagId,
  });
  await createBuyViaApi(request, {
    product_name: 'Funda sin etiquetar',
    purchase_cost: 4,
    quantity: 2,
  });

  await page.goto('/buys');
  const taggedRow = page.getByRole('row').filter({ hasText: 'Funda con etiqueta' });
  const untaggedRow = page.getByRole('row').filter({ hasText: 'Funda sin etiquetar' });
  await expect(taggedRow).toBeVisible();
  await expect(untaggedRow).toBeVisible();

  const filter = page.getByRole('group', { name: 'Filtro de tags' });
  await filter.getByRole('button', { name: TAG_NAME, exact: true }).click();

  await expect(taggedRow).toBeVisible();
  await expect(untaggedRow).toHaveCount(0);

  await filter.getByRole('button', { name: 'Sin tag', exact: true }).click();

  await expect(untaggedRow).toBeVisible();
  await expect(taggedRow).toHaveCount(0);

  await page.getByRole('button', { name: 'Quitar filtro de tags' }).click();

  await expect(taggedRow).toBeVisible();
  await expect(untaggedRow).toBeVisible();
});

test('/buys: editar el color de un tag actualiza el swatch y el tinte de la fila', async ({
  page,
  request,
}) => {
  const tagId = await createTagViaApi(request, TAG_NAME, TAG_COLOR);
  await createBuyViaApi(request, {
    product_name: 'Funda recoloreada',
    purchase_cost: 5,
    quantity: 3,
    tag_id: tagId,
  });

  await page.goto('/buys');
  await page.getByRole('button', { name: 'Gestionar tags' }).click();
  const modal = page.getByRole('dialog');

  await modal.getByRole('button', { name: `Editar ${TAG_NAME}` }).click();
  const editRow = modal.getByRole('listitem').filter({ hasText: TAG_NAME });
  await editRow.getByLabel('Color libre').fill(NEW_TAG_COLOR);
  await editRow.getByRole('button', { name: 'Guardar' }).click();

  await expect(modal.getByRole('button', { name: `Editar ${TAG_NAME}` })).toBeVisible();
  const tagItem = modal.getByRole('listitem').filter({ hasText: TAG_NAME });
  await expect(tagItem.locator('span[style*="background-color"]').first()).toHaveCSS(
    'background-color',
    NEW_TAG_COLOR_RGB,
  );

  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).toBeHidden();

  const row = page.getByRole('row').filter({ hasText: 'Funda recoloreada' });
  await expect(row).toHaveClass(/tag-row-tinted/);
  await expect(row).toHaveAttribute('style', /--tag-color:\s*#0d9488/i);
});

test('/buys: el filtro de tags queda pegado al borde derecho de la barra de filtros', async ({
  page,
  request,
}) => {
  await createTagViaApi(request, TAG_NAME, TAG_COLOR);
  await createBuyViaApi(request, {
    product_name: 'Funda con etiqueta',
    purchase_cost: 5,
    quantity: 3,
  });

  await page.goto('/buys');

  const sinTag = page.getByRole('button', { name: 'Sin tag', exact: true });
  const quitar = page.getByRole('button', { name: 'Quitar filtro de tags' });
  const nuevaCompra = page.getByRole('button', { name: '+ Nueva compra' });

  await expect(sinTag).toBeVisible();
  await expect(quitar).toBeVisible();
  await expect(nuevaCompra).toBeVisible();

  const [chipBox, quitarBox, buttonBox] = await Promise.all([
    sinTag.boundingBox(),
    quitar.boundingBox(),
    nuevaCompra.boundingBox(),
  ]);

  expect(chipBox).not.toBeNull();
  expect(quitarBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();

  const rightEdge = buttonBox!.x + buttonBox!.width;
  expect(Math.abs(chipBox!.x + chipBox!.width - rightEdge)).toBeLessThan(2);
  expect(Math.abs(quitarBox!.x + quitarBox!.width - rightEdge)).toBeLessThan(2);
});

test('/buys: etiquetar una compra desde la app actualiza el contador del tag y avisa al borrarlo', async ({
  page,
  request,
}) => {
  await createTagViaApi(request, TAG_NAME, TAG_COLOR);
  await createBuyViaApi(request, {
    product_name: 'Funda etiquetada',
    purchase_cost: 5,
    quantity: 3,
  });

  await page.goto('/buys');
  await page.getByRole('link', { name: 'Editar Funda etiquetada' }).click();
  await page.getByLabel('Tag', { exact: true }).selectOption({ label: TAG_NAME });
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(/\/buys$/);

  await page.getByRole('button', { name: 'Gestionar tags' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByText('1 compra')).toBeVisible();

  await modal.getByRole('button', { name: `Borrar ${TAG_NAME}` }).click();
  const confirm = modal.getByRole('button', { name: 'Sí, borrar' });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(modal.getByText('Funda etiquetada')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Sí, borrar el tag' })).toBeVisible();
});

test('/buys: borrar un tag deja las compras sin etiqueta y no las borra', async ({
  page,
  request,
}) => {
  const tagId = await createTagViaApi(request, TAG_NAME, TAG_COLOR);
  await createBuyViaApi(request, {
    product_name: 'Funda superviviente',
    purchase_cost: 5,
    quantity: 3,
    tag_id: tagId,
  });

  await page.goto('/buys');
  await page.getByRole('button', { name: 'Gestionar tags' }).click();
  const modal = page.getByRole('dialog');

  await modal.getByRole('button', { name: `Borrar ${TAG_NAME}` }).click();
  await expect(
    modal.getByText(`¿Estás seguro de que quieres borrar el tag «${TAG_NAME}»?`),
  ).toBeVisible();

  const confirm = modal.getByRole('button', { name: 'Sí, borrar' });
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(modal.getByText(/tiene/)).toBeVisible();
  await expect(modal.getByText(/sin etiqueta/)).toBeVisible();
  await expect(modal.getByText('Funda superviviente')).toBeVisible();

  await modal.getByRole('button', { name: 'Sí, borrar el tag' }).click();

  await expect(modal.getByRole('button', { name: `Editar ${TAG_NAME}` })).toHaveCount(0);
  await expect(modal.getByText(TAG_NAME, { exact: true })).toHaveCount(0);

  await modal.getByRole('button', { name: 'Cerrar' }).click();
  await expect(modal).toBeHidden();

  const row = page.getByRole('row').filter({ hasText: 'Funda superviviente' });
  await expect(row).toBeVisible();
  await expect(page.getByRole('img', { name: `Tag: ${TAG_NAME}` })).toHaveCount(0);
  await expect(row).not.toHaveClass(/tag-row-tinted/);
});
