process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'production';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Database } from 'better-sqlite3';

const { openDb } = await import('../db/index.js');
const { runMigrations } = await import('../db/migrate.js');
const { createBuysRepo } = await import('../repo/buys-repo.js');
const { createSoldsRepo } = await import('../repo/solds-repo.js');
const { createCustomersRepo } = await import('../repo/customers-repo.js');
const {
  createExpensesRepo,
  createExpenseCategoriesRepo,
  DuplicateExpenseCategoryError,
  UnknownExpenseCategoryError,
} = await import('../repo/expenses-repo.js');
const { createApp } = await import('../app.js');

describe('expenses y categorías de gasto', () => {
  let db: Database;
  let server: Server;
  let baseUrl: string;
  let expensesRepo: ReturnType<typeof createExpensesRepo>;
  let categoriesRepo: ReturnType<typeof createExpenseCategoriesRepo>;
  let customersRepo: ReturnType<typeof createCustomersRepo>;

  beforeEach(async () => {
    db = openDb(':memory:');
    runMigrations(db);
    expensesRepo = createExpensesRepo(db);
    categoriesRepo = createExpenseCategoriesRepo(db);
    customersRepo = createCustomersRepo(db);
    const app = createApp({
      buysRepo: createBuysRepo(db),
      soldsRepo: createSoldsRepo(db),
      customersRepo,
    });
    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    vi.restoreAllMocks();
    db.close();
  });

  async function api(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: Record<string, unknown> | null }> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return {
      status: res.status,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    };
  }

  function seedCategory(name = 'Alquiler') {
    return categoriesRepo.create({ name });
  }

  describe('repo de categorías', () => {
    it('crea una categoría con su nombre', () => {
      const category = seedCategory('Alquiler');
      expect(category.id).toBeGreaterThan(0);
      expect(category.name).toBe('Alquiler');
      expect(category.expenses_count).toBe(0);
      expect(category.total_amount).toBe(0);
    });

    it('rechaza dos categorías con el mismo nombre ignorando mayúsculas', () => {
      seedCategory('Alquiler');
      expect(() => seedCategory('alquiler')).toThrow(DuplicateExpenseCategoryError);
    });

    it('la lista trae el número de gastos y el total de cada categoría', () => {
      const alquiler = seedCategory('Alquiler');
      const material = seedCategory('Material');
      expensesRepo.create({
        concept: 'Alquiler de marzo',
        amount: 400,
        category_id: alquiler.id,
        expense_date: '2026-03-01',
      });
      expensesRepo.create({
        concept: 'Cajas',
        amount: 12.5,
        category_id: material.id,
        expense_date: '2026-03-02',
      });

      const list = categoriesRepo.list();
      const alquilerRow = list.find((c) => c.id === alquiler.id);
      const materialRow = list.find((c) => c.id === material.id);

      expect(alquilerRow?.expenses_count).toBe(1);
      expect(alquilerRow?.total_amount).toBe(400);
      expect(materialRow?.expenses_count).toBe(1);
      expect(materialRow?.total_amount).toBe(12.5);
    });

    it('renombra una categoría', () => {
      const category = seedCategory('Alquiler');
      const updated = categoriesRepo.update(category.id, { name: 'Renta' });
      expect(updated?.name).toBe('Renta');
    });

    it('no borra una categoría con gastos asociados', () => {
      const category = seedCategory('Alquiler');
      expensesRepo.create({
        concept: 'Alquiler de marzo',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      const result = categoriesRepo.remove(category.id);

      expect(result).toEqual({ ok: false, code: 'HAS_EXPENSES', expenses_count: 1 });
      expect(categoriesRepo.getById(category.id)).not.toBeNull();
    });

    it('borra una categoría sin gastos', () => {
      const category = seedCategory('Alquiler');
      expect(categoriesRepo.remove(category.id)).toEqual({ ok: true });
      expect(categoriesRepo.getById(category.id)).toBeNull();
    });

    it('devuelve NOT_FOUND al borrar una categoría inexistente', () => {
      expect(categoriesRepo.remove(9999)).toEqual({ ok: false, code: 'NOT_FOUND' });
    });
  });

  describe('repo de gastos', () => {
    it('crea un gasto con su categoría', () => {
      const category = seedCategory();
      const expense = expensesRepo.create({
        concept: 'Alquiler de marzo',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      expect(expense.id).toBeGreaterThan(0);
      expect(expense.concept).toBe('Alquiler de marzo');
      expect(expense.amount).toBe(400);
      expect(expense.category_id).toBe(category.id);
      expect(expense.category_name).toBe('Alquiler');
      expect(expense.expense_date).toBe('2026-03-01');
    });

    it('rechaza un gasto con una categoría inexistente', () => {
      expect(() =>
        expensesRepo.create({
          concept: 'Alquiler',
          amount: 400,
          category_id: 9999,
          expense_date: '2026-03-01',
        }),
      ).toThrow(UnknownExpenseCategoryError);
    });

    it('lista los gastos ordenados por fecha descendente', () => {
      const category = seedCategory();
      expensesRepo.create({
        concept: 'Marzo',
        amount: 10,
        category_id: category.id,
        expense_date: '2026-03-01',
      });
      expensesRepo.create({
        concept: 'Abril',
        amount: 20,
        category_id: category.id,
        expense_date: '2026-04-01',
      });

      const list = expensesRepo.list();
      expect(list.map((e) => e.concept)).toEqual(['Abril', 'Marzo']);
    });

    it('filtra la lista por categoría', () => {
      const alquiler = seedCategory('Alquiler');
      const material = seedCategory('Material');
      expensesRepo.create({
        concept: 'Alquiler de marzo',
        amount: 400,
        category_id: alquiler.id,
        expense_date: '2026-03-01',
      });
      expensesRepo.create({
        concept: 'Cajas',
        amount: 12.5,
        category_id: material.id,
        expense_date: '2026-03-02',
      });

      const list = expensesRepo.list({ categoryId: material.id });
      expect(list).toHaveLength(1);
      expect(list[0]?.concept).toBe('Cajas');
      expect(expensesRepo.total({ categoryId: material.id })).toBe(12.5);
      expect(expensesRepo.total()).toBe(412.5);
    });

    it('actualiza un gasto', () => {
      const category = seedCategory();
      const expense = expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      const updated = expensesRepo.update(expense.id, { amount: 450, concept: 'Alquiler pagado' });

      expect(updated?.amount).toBe(450);
      expect(updated?.concept).toBe('Alquiler pagado');
      expect(updated?.created_at).toBe(expense.created_at);
    });

    it('rechaza mover un gasto a una categoría inexistente', () => {
      const category = seedCategory();
      const expense = expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      expect(() => expensesRepo.update(expense.id, { category_id: 9999 })).toThrow(
        UnknownExpenseCategoryError,
      );
    });

    it('borra un gasto', () => {
      const category = seedCategory();
      const expense = expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      expect(expensesRepo.remove(expense.id)).toBe(true);
      expect(expensesRepo.getById(expense.id)).toBeNull();
    });
  });

  describe('API de gastos', () => {
    it('POST /api/expenses crea un gasto', async () => {
      const category = seedCategory();

      const res = await api('POST', '/api/expenses', {
        concept: 'Alquiler de marzo',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      expect(res.status).toBe(201);
      expect(res.body?.data).toMatchObject({
        concept: 'Alquiler de marzo',
        amount: 400,
        category_id: category.id,
        category_name: 'Alquiler',
        expense_date: '2026-03-01',
      });
    });

    it('POST /api/expenses con datos inválidos devuelve 400', async () => {
      const res = await api('POST', '/api/expenses', { concept: '', amount: 400 });

      expect(res.status).toBe(400);
      expect(res.body?.error).toBe('Datos de gasto inválidos');
    });

    it('POST /api/expenses con categoría inexistente devuelve 400', async () => {
      const res = await api('POST', '/api/expenses', {
        concept: 'Alquiler',
        amount: 400,
        category_id: 9999,
        expense_date: '2026-03-01',
      });

      expect(res.status).toBe(400);
      expect(res.body?.error).toBe('La categoría de gasto no existe');
    });

    it('GET /api/expenses devuelve la lista y el total', async () => {
      const category = seedCategory();
      expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      const res = await api('GET', '/api/expenses');

      expect(res.status).toBe(200);
      expect((res.body?.data as unknown[]).length).toBe(1);
      expect(res.body?.total).toBe(400);
    });

    it('GET /api/expenses?category_id filtra por categoría', async () => {
      const alquiler = seedCategory('Alquiler');
      const material = seedCategory('Material');
      expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: alquiler.id,
        expense_date: '2026-03-01',
      });
      expensesRepo.create({
        concept: 'Cajas',
        amount: 12.5,
        category_id: material.id,
        expense_date: '2026-03-02',
      });

      const res = await api('GET', `/api/expenses?category_id=${material.id}`);

      expect(res.status).toBe(200);
      expect((res.body?.data as unknown[]).length).toBe(1);
      expect(res.body?.total).toBe(12.5);
    });

    it('GET /api/expenses con category_id inválido devuelve 400', async () => {
      const res = await api('GET', '/api/expenses?category_id=abc');

      expect(res.status).toBe(400);
      expect(res.body?.error).toBe('Parámetros inválidos');
    });

    it('GET /api/expenses/:id devuelve 404 si no existe', async () => {
      const res = await api('GET', '/api/expenses/9999');

      expect(res.status).toBe(404);
      expect(res.body?.error).toBe('Gasto no encontrado');
    });

    it('PATCH /api/expenses/:id actualiza el gasto', async () => {
      const category = seedCategory();
      const expense = expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      const res = await api('PATCH', `/api/expenses/${expense.id}`, { amount: 450 });

      expect(res.status).toBe(200);
      expect((res.body?.data as { amount: number }).amount).toBe(450);
    });

    it('DELETE /api/expenses/:id borra el gasto', async () => {
      const category = seedCategory();
      const expense = expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      const res = await api('DELETE', `/api/expenses/${expense.id}`);

      expect(res.status).toBe(204);
      expect(expensesRepo.getById(expense.id)).toBeNull();
    });
  });

  describe('API de categorías de gasto', () => {
    it('POST /api/expense-categories crea la categoría', async () => {
      const res = await api('POST', '/api/expense-categories', { name: 'Alquiler' });

      expect(res.status).toBe(201);
      expect(res.body?.data).toMatchObject({ name: 'Alquiler', expenses_count: 0 });
    });

    it('POST /api/expense-categories con nombre duplicado devuelve 409', async () => {
      seedCategory('Alquiler');

      const res = await api('POST', '/api/expense-categories', { name: 'alquiler' });

      expect(res.status).toBe(409);
      expect(res.body?.error).toBe('Ya existe una categoría de gasto con ese nombre');
    });

    it('GET /api/expense-categories lista las categorías con sus totales', async () => {
      const category = seedCategory('Alquiler');
      expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      const res = await api('GET', '/api/expense-categories');

      expect(res.status).toBe(200);
      expect(res.body?.data).toEqual([
        {
          id: category.id,
          name: 'Alquiler',
          created_at: expect.any(String),
          expenses_count: 1,
          total_amount: 400,
        },
      ]);
    });

    it('PATCH /api/expense-categories/:id renombra la categoría', async () => {
      const category = seedCategory('Alquiler');

      const res = await api('PATCH', `/api/expense-categories/${category.id}`, { name: 'Renta' });

      expect(res.status).toBe(200);
      expect((res.body?.data as { name: string }).name).toBe('Renta');
    });

    it('DELETE /api/expense-categories/:id con gastos asociados devuelve 409', async () => {
      const category = seedCategory('Alquiler');
      expensesRepo.create({
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      const res = await api('DELETE', `/api/expense-categories/${category.id}`);

      expect(res.status).toBe(409);
      expect(res.body?.error).toBe('No se puede borrar: la categoría tiene gastos asociados');
      expect(res.body?.expenses_count).toBe(1);
      expect(categoriesRepo.getById(category.id)).not.toBeNull();
    });

    it('DELETE /api/expense-categories/:id sin gastos devuelve 204', async () => {
      const category = seedCategory('Alquiler');

      const res = await api('DELETE', `/api/expense-categories/${category.id}`);

      expect(res.status).toBe(204);
      expect(categoriesRepo.getById(category.id)).toBeNull();
    });

    it('DELETE /api/expense-categories/:id inexistente devuelve 404', async () => {
      const res = await api('DELETE', '/api/expense-categories/9999');

      expect(res.status).toBe(404);
      expect(res.body?.error).toBe('Categoría de gasto no encontrada');
    });
  });

  describe('clientes y gastos no se mezclan', () => {
    it('crear un gasto no crea clientes ni ventas', async () => {
      const category = seedCategory();

      await api('POST', '/api/expenses', {
        concept: 'Alquiler',
        amount: 400,
        category_id: category.id,
        expense_date: '2026-03-01',
      });

      expect(customersRepo.list()).toEqual([]);
      const customers = db.prepare('SELECT COUNT(*) AS c FROM customers').get() as { c: number };
      const solds = db.prepare('SELECT COUNT(*) AS c FROM solds').get() as { c: number };
      expect(customers.c).toBe(0);
      expect(solds.c).toBe(0);
    });
  });
});
