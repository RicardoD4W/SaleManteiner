import { expect } from '@playwright/test';
import { test } from './fixtures';

async function clearExpenses(request: import('@playwright/test').APIRequestContext): Promise<void> {
  const expenses = await request.get('/api/expenses');
  expect(expenses.ok(), `GET /api/expenses falló: ${expenses.status()}`).toBe(true);
  const expensesBody = (await expenses.json()) as { data: Array<{ id: number }> };
  for (const { id } of expensesBody.data) {
    const del = await request.delete(`/api/expenses/${id}`);
    expect(del.ok(), `DELETE /api/expenses/${id} falló: ${del.status()}`).toBe(true);
  }

  const categories = await request.get('/api/expense-categories');
  expect(categories.ok(), `GET /api/expense-categories falló: ${categories.status()}`).toBe(true);
  const categoriesBody = (await categories.json()) as { data: Array<{ id: number }> };
  for (const { id } of categoriesBody.data) {
    const del = await request.delete(`/api/expense-categories/${id}`);
    expect(del.ok(), `DELETE /api/expense-categories/${id} falló: ${del.status()}`).toBe(true);
  }
}

async function createCategory(
  request: import('@playwright/test').APIRequestContext,
  name: string,
): Promise<number> {
  const res = await request.post('/api/expense-categories', { data: { name } });
  expect(res.ok(), `POST /api/expense-categories falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: { id: number } };
  return body.data.id;
}

test.beforeEach(async ({ request }) => {
  await clearExpenses(request);
});

test('crea la primera categoría en línea y registra un gasto', async ({ page, request }) => {
  await page.goto('/expenses');

  await page.getByRole('button', { name: '+ Nuevo gasto' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Nuevo gasto')).toBeVisible();
  await expect(dialog.getByText('No hay categorías todavía')).toBeVisible();

  await dialog.getByLabel('Nombre de la nueva categoría').fill('Alquiler');
  await dialog.getByRole('button', { name: 'Crear y usar' }).click();
  await expect(dialog.getByLabel('Nombre de la nueva categoría')).toHaveCount(0);

  await expect
    .poll(async () =>
      dialog
        .getByLabel('Categoría *')
        .evaluate(
          (element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent ?? '',
        ),
    )
    .toBe('Alquiler');

  await dialog.getByLabel('Concepto *').fill('Alquiler de octubre');
  await dialog.getByLabel('Importe (€) *').fill('1200');
  await dialog.getByLabel('Fecha *').fill('2026-10-02');
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('cell', { name: 'Alquiler de octubre', exact: true })).toBeVisible();
  await expect(page.getByText('Total: 1200,00 €')).toBeVisible();

  const expenses = await request.get('/api/expenses');
  const expensesBody = (await expenses.json()) as {
    data: Array<{ concept: string; amount: number; expense_date: string }>;
  };
  expect(expensesBody.data).toHaveLength(1);
  expect(expensesBody.data[0].concept).toBe('Alquiler de octubre');
  expect(expensesBody.data[0].amount).toBe(1200);
  expect(expensesBody.data[0].expense_date).toBe('2026-10-02');

  await page.getByRole('button', { name: 'Gestionar categorías' }).click();
  const manager = page.getByRole('dialog');
  await expect(manager.getByText('1 gasto')).toBeVisible();
  await expect(manager.getByText(/1200,00\s*€/)).toBeVisible();
});

test('filtra por categoría y muestra el total de lo filtrado', async ({ page, request }) => {
  const alquilerId = await createCategory(request, 'Alquiler');
  const suministrosId = await createCategory(request, 'Suministros');

  await request.post('/api/expenses', {
    data: {
      concept: 'Alquiler de octubre',
      amount: 1200,
      category_id: alquilerId,
      expense_date: '2026-10-02',
    },
  });
  await request.post('/api/expenses', {
    data: {
      concept: 'Papel de impresora',
      amount: 150,
      category_id: suministrosId,
      expense_date: '2026-10-05',
    },
  });

  await page.goto('/expenses');
  await expect(page.getByRole('cell', { name: 'Papel de impresora', exact: true })).toBeVisible();
  await expect(page.getByText('Total: 1350,00 €')).toBeVisible();

  await page.getByLabel('Categoría').selectOption({ label: 'Suministros' });

  await expect(page.getByRole('cell', { name: 'Alquiler de octubre', exact: true })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Papel de impresora', exact: true })).toBeVisible();
  await expect(page.getByText('Total: 150,00 €')).toBeVisible();
});

test('no borra una categoría en uso: avisa del 409 y la mantiene', async ({ page, request }) => {
  const alquilerId = await createCategory(request, 'Alquiler');
  await request.post('/api/expenses', {
    data: {
      concept: 'Alquiler de octubre',
      amount: 1200,
      category_id: alquilerId,
      expense_date: '2026-10-02',
    },
  });

  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Gestionar categorías' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Categorías de gasto')).toBeVisible();
  await dialog.getByRole('button', { name: 'Borrar Alquiler' }).click();
  await dialog.getByRole('button', { name: 'Sí, eliminar' }).click();

  const cascade = page.getByRole('dialog', { name: 'La categoría tiene gastos asociados' });
  await expect(cascade).toBeVisible();
  await expect(cascade.getByText('"Alquiler"', { exact: true })).toBeVisible();

  const categories = await request.get('/api/expense-categories');
  const categoriesBody = (await categories.json()) as { data: Array<{ id: number }> };
  expect(categoriesBody.data.some((category) => category.id === alquilerId)).toBe(true);
});

test('borra en cascada la categoría y sus gastos cuando se confirma el aviso', async ({
  page,
  request,
}) => {
  const luzId = await createCategory(request, 'Luz');
  const expenseRes = await request.post('/api/expenses', {
    data: {
      concept: 'Factura de luz',
      amount: 75.5,
      category_id: luzId,
      expense_date: '2026-10-03',
    },
  });
  expect(expenseRes.ok(), `POST /api/expenses falló: ${expenseRes.status()}`).toBe(true);
  const expenseBody = (await expenseRes.json()) as { data: { id: number } };
  const expenseId = expenseBody.data.id;

  await page.goto('/gastos');
  await page.getByRole('button', { name: 'Gestionar categorías' }).click();

  const manager = page.getByRole('dialog', { name: 'Categorías de gasto' });
  await expect(manager.getByText('Luz', { exact: true })).toBeVisible();
  await manager.getByRole('button', { name: 'Borrar Luz' }).click();
  await manager.getByRole('button', { name: 'Sí, eliminar' }).click();

  const cascade = page.getByRole('dialog', { name: 'La categoría tiene gastos asociados' });
  await expect(cascade).toBeVisible();
  await expect(cascade.getByText(`Gasto #${expenseId}`)).toBeVisible();
  await expect(cascade.getByText('Factura de luz')).toBeVisible();
  await cascade.getByRole('button', { name: 'Borrar también los gastos y la categoría' }).click();

  await expect(cascade).toBeHidden();

  const categories = await request.get('/api/expense-categories');
  const categoriesBody = (await categories.json()) as { data: Array<{ name: string }> };
  expect(categoriesBody.data.some((category) => category.name === 'Luz')).toBe(false);

  const expenses = await request.get('/api/expenses');
  const expensesBody = (await expenses.json()) as { data: Array<{ concept: string }> };
  expect(expensesBody.data.some((expense) => expense.concept === 'Factura de luz')).toBe(false);

  await expect(page.getByRole('cell', { name: 'Factura de luz', exact: true })).toHaveCount(0);
});
