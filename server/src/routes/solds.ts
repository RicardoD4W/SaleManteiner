import { Router } from 'express';
import type { SoldsRepo } from '../repo/solds-repo.js';
import { StockInsufficientError } from '../repo/solds-repo.js';
import { CreateSoldInput, UpdateSoldInput } from '../schemas/solds.js';
import { IdParam, SalesListQuery, asyncHandler, respondBadRequest } from './_shared.js';

export interface SoldsRouterDeps {
  repo: SoldsRepo;
}

export function soldsRouter(deps: SoldsRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = SalesListQuery.safeParse(req.query);
      if (!parsed.success) {
        return respondBadRequest(res, 'Parámetros inválidos', parsed.error.flatten());
      }
      const filters = {
        customerId: parsed.data.customerId,
        ...(parsed.data.from || parsed.data.to
          ? { dateRange: { from: parsed.data.from, to: parsed.data.to } }
          : {}),
      };
      const data = repo.listWithProfit(Object.keys(filters).length > 0 ? filters : undefined);
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
      const data = repo.getByIdWithItems(parsed.data.id);
      if (!data) {
        return res.status(404).json({ error: 'Venta no encontrada', id: parsed.data.id });
      }
      res.json({ data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = CreateSoldInput.safeParse(req.body);
      if (!parsed.success) {
        return respondBadRequest(res, 'Datos de venta inválidos', parsed.error.flatten());
      }

      try {
        const data = repo.createManyWithStockCheck(parsed.data);
        res.status(201).json({ data });
      } catch (err) {
        if (err instanceof StockInsufficientError) {
          return res.status(422).json({
            error: err.error,
            items: err.items,
          });
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
      const body = UpdateSoldInput.safeParse(req.body);
      if (!body.success) {
        return respondBadRequest(res, 'Datos de actualización inválidos', body.error.flatten());
      }
      const data = repo.update(params.data.id, body.data);
      if (!data) {
        return res.status(404).json({ error: 'Venta no encontrada', id: params.data.id });
      }
      res.json({ data });
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
        return res.status(404).json({ error: 'Venta no encontrada', id: parsed.data.id });
      }
      res.status(204).end();
    }),
  );

  return router;
}
