import { Router } from 'express';
import type { SoldsRepo } from '../repo/solds-repo.js';
import { asyncHandler } from './_shared.js';

export interface DashboardRouterDeps {
  repo: SoldsRepo;
}

export function dashboardRouter(deps: DashboardRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  router.get(
    '/dashboard',
    asyncHandler(async (_req, res) => {
      const data = repo.statsDashboard();
      res.json({ data });
    }),
  );

  return router;
}
