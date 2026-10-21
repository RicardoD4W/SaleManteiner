import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../logger.js';
import type { CustomersRepo } from '../repo/customers-repo.js';
import { CreateCustomerInput, UpdateCustomerInput } from '../schemas/customers.js';

export interface CustomersRouterDeps {
  repo: CustomersRepo;
}

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const SearchQuery = z.object({ name: z.string().min(1).optional() });

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function customersRouter(deps: CustomersRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = SearchQuery.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Parámetros inválidos',
          issues: parsed.error.flatten(),
        });
      }
      if (parsed.data.name) {
        const data = repo.search(parsed.data.name);
        return res.json({ data });
      }
      const data = repo.list();
      res.json({ data });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Id inválido', issues: parsed.error.flatten() });
      }
      const data = repo.getById(parsed.data.id);
      if (!data) {
        return res.status(404).json({ error: 'Cliente no encontrado', id: parsed.data.id });
      }
      res.json({ data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = CreateCustomerInput.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Datos inválidos',
          issues: parsed.error.flatten(),
        });
      }
      const data = repo.create(parsed.data);
      res.status(201).json({ data });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const params = IdParam.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ error: 'Id inválido', issues: params.error.flatten() });
      }
      const body = UpdateCustomerInput.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          error: 'Datos de actualización inválidos',
          issues: body.error.flatten(),
        });
      }
      const data = repo.update(params.data.id, body.data);
      if (!data) {
        return res.status(404).json({ error: 'Cliente no encontrado', id: params.data.id });
      }
      res.json({ data });
    }),
  );

  // La ruta cascade se registra antes que `/:id` por claridad de lectura.
  // OJO: en Express 5 el parámetro `:id` NO matchea segmentos con '/'
  // (path-to-regexp v8 usa `[^/]+`), así que '/5/cascade' nunca matchearía
  // `/:id`. El orden NO es lo que protege esta ruta — lo que la protege es
  // que el path tenga dos segmentos. El test de rutas
  // `server/src/__tests__/customers-routes.test.ts` lo verifica por HTTP.
  router.delete(
    '/:id/cascade',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Id inválido', issues: parsed.error.flatten() });
      }
      const id = parsed.data.id;
      // Si el cliente no existe no hay nada que borrar ni que registrar.
      if (!repo.getById(id)) {
        return res.status(404).json({ error: 'Cliente no encontrado', id });
      }
      // Audit trail WRITE-AHEAD: la cascada NO tiene undo, así que el log
      // va ANTES del borrado. Con el log después, un crash entre el commit
      // de la transacción y el log dejaría un borrado sin registrar (justo
      // lo que un audit trail no puede pasar). Si el borrado falla después,
      // el log de error deja asentado que no se completó.
      const affected = repo.listAssociatedSales(id);
      logger.warn(
        {
          customer_id: id,
          affected_sales: affected.map((s) => ({
            id: s.id,
            customer_name: s.customer_name,
            items_count: s.items_count,
          })),
        },
        'Borrado en cascada de cliente (iniciado)',
      );
      let removed: boolean;
      try {
        removed = repo.removeWithCascade(id);
      } catch (err) {
        logger.error({ err, customer_id: id }, 'Borrado en cascada fallido: no se completó');
        throw err;
      }
      if (!removed) {
        // Solo puede pasar si el cliente se borró entre el check y el
        // borrado (otro proceso).
        logger.error(
          { customer_id: id },
          'Borrado en cascada sin efecto: el cliente ya no existía',
        );
        return res.status(404).json({ error: 'Cliente no encontrado', id });
      }
      res.status(204).end();
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Id inválido', issues: parsed.error.flatten() });
      }
      const result = repo.remove(parsed.data.id);
      if (result.ok) {
        return res.status(204).end();
      }
      if (result.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Cliente no encontrado', id: parsed.data.id });
      }
      // HAS_ASSOCIATED_SALES: 409 con la lista de ventas para que la UI
      // pueda mostrar el modal de confirmación cascade.
      return res.status(409).json({
        error:
          'No se puede borrar: el cliente tiene ventas asociadas. ¿Querés borrar también las ventas?',
        associated_sales: result.sales,
      });
    }),
  );

  return router;
}
