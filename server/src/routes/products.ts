import { Router } from 'express';
import type { BuysRepo } from '../repo/buys-repo.js';
import { asyncHandler } from './_shared.js';

export interface ProductsRouterDeps {
  repo: BuysRepo;
}

export function productsRouter(deps: ProductsRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: repo.listProductNames() });
    }),
  );

  return router;
}
