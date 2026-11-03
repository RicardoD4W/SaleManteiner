import { Router } from 'express';
import type { ExpensesRepo } from '../repo/expenses-repo.js';
import { UnknownExpenseCategoryError } from '../repo/expenses-repo.js';
import { CreateExpenseInput, UpdateExpenseInput } from '../schemas/expenses.js';
import { ExpensesListQuery, IdParam, asyncHandler, respondBadRequest } from './_shared.js';

export interface ExpensesRouterDeps {
  repo: ExpensesRepo;
}

export function expensesRouter(deps: ExpensesRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = ExpensesListQuery.safeParse(req.query);
      if (!parsed.success) {
        return respondBadRequest(res, 'Parámetros inválidos', parsed.error.flatten());
      }
      const filters =
        parsed.data.category_id !== undefined ? { categoryId: parsed.data.category_id } : undefined;
      const data = repo.list(filters);
      const total = repo.total(filters);
      res.json({ data, total });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return respondBadRequest(res, 'Id inválido', parsed.error.flatten());
      }
      const data = repo.getById(parsed.data.id);
      if (!data) {
        return res.status(404).json({ error: 'Gasto no encontrado', id: parsed.data.id });
      }
      res.json({ data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = CreateExpenseInput.safeParse(req.body);
      if (!parsed.success) {
        return respondBadRequest(res, 'Datos de gasto inválidos', parsed.error.flatten());
      }
      try {
        const data = repo.create(parsed.data);
        res.status(201).json({ data });
      } catch (err) {
        if (err instanceof UnknownExpenseCategoryError) {
          return res.status(400).json({ error: err.error });
        }
        throw err;
      }
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const params = IdParam.safeParse(req.params);
      if (!params.success) {
        return respondBadRequest(res, 'Id inválido', params.error.flatten());
      }
      const body = UpdateExpenseInput.safeParse(req.body);
      if (!body.success) {
        return respondBadRequest(res, 'Datos de actualización inválidos', body.error.flatten());
      }
      try {
        const data = repo.update(params.data.id, body.data);
        if (!data) {
          return res.status(404).json({ error: 'Gasto no encontrado', id: params.data.id });
        }
        res.json({ data });
      } catch (err) {
        if (err instanceof UnknownExpenseCategoryError) {
          return res.status(400).json({ error: err.error });
        }
        throw err;
      }
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return respondBadRequest(res, 'Id inválido', parsed.error.flatten());
      }
      const removed = repo.remove(parsed.data.id);
      if (!removed) {
        return res.status(404).json({ error: 'Gasto no encontrado', id: parsed.data.id });
      }
      res.status(204).end();
    }),
  );

  return router;
}
