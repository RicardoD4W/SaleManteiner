import { Router } from 'express';
import type { MetricsRepo } from '../repo/metrics-repo.js';
import { asyncHandler } from './_shared.js';

export interface MetricsRouterDeps {
  repo: MetricsRepo;
}

export function metricsRouter(deps: MetricsRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  router.get(
    '/metrics',
    asyncHandler(async (_req, res) => {
      res.json({ data: repo.stats() });
    }),
  );

  return router;
}
