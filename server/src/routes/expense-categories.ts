import { Router } from 'express';
import type { ExpenseCategoriesRepo } from '../repo/expenses-repo.js';
import { DuplicateExpenseCategoryError } from '../repo/expenses-repo.js';
import { CreateExpenseCategoryInput, UpdateExpenseCategoryInput } from '../schemas/expenses.js';
import { IdParam, asyncHandler, respondBadRequest } from './_shared.js';

export interface ExpenseCategoriesRouterDeps {
  repo: ExpenseCategoriesRepo;
}

export function expenseCategoriesRouter(deps: ExpenseCategoriesRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const data = repo.list();
      res.json({ data });
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
        return res.status(404).json({
          error: 'Categoría de gasto no encontrada',
          id: parsed.data.id,
        });
      }
      res.json({ data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = CreateExpenseCategoryInput.safeParse(req.body);
      if (!parsed.success) {
        return respondBadRequest(res, 'Datos de categoría inválidos', parsed.error.flatten());
      }
      try {
        const data = repo.create(parsed.data);
        res.status(201).json({ data });
      } catch (err) {
        if (err instanceof DuplicateExpenseCategoryError) {
          return res.status(409).json({ error: err.error });
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
      const body = UpdateExpenseCategoryInput.safeParse(req.body);
      if (!body.success) {
        return respondBadRequest(res, 'Datos de actualización inválidos', body.error.flatten());
      }
      try {
        const data = repo.update(params.data.id, body.data);
        if (!data) {
          return res.status(404).json({
            error: 'Categoría de gasto no encontrada',
            id: params.data.id,
          });
        }
        res.json({ data });
      } catch (err) {
        if (err instanceof DuplicateExpenseCategoryError) {
          return res.status(409).json({ error: err.error });
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
      const result = repo.remove(parsed.data.id);
      if (result.ok) {
        return res.status(204).end();
      }
      if (result.code === 'NOT_FOUND') {
        return res.status(404).json({
          error: 'Categoría de gasto no encontrada',
          id: parsed.data.id,
        });
      }
      return res.status(409).json({
        error: 'No se puede borrar: la categoría tiene gastos asociados',
        expenses_count: result.expenses_count,
      });
    }),
  );

  return router;
}
