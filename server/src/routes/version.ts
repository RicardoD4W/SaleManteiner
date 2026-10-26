import { Router, type Request, type Response } from 'express';
import { appVersions } from '../version.js';

export function versionRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(appVersions());
  });

  return router;
}
