import { Router } from 'express';
import type { TagsRepo } from '../repo/tags-repo.js';
import { DuplicateTagError } from '../repo/tags-repo.js';
import { CreateTagInput, TagScope, UpdateTagInput } from '../schemas/tags.js';
import { IdParam, asyncHandler, respondBadRequest } from './_shared.js';

export interface TagsRouterDeps {
  repo: TagsRepo;
}

export function createTagsRouter(scope: TagScope, deps: TagsRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const data = repo.list(scope);
      res.json({ data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = CreateTagInput.safeParse(req.body);
      if (!parsed.success) {
        return respondBadRequest(res, 'Datos de tag inválidos', parsed.error.flatten());
      }
      try {
        const data = repo.create(scope, parsed.data);
        res.status(201).json({ data });
      } catch (err) {
        if (err instanceof DuplicateTagError) {
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
      const body = UpdateTagInput.safeParse(req.body);
      if (!body.success) {
        return respondBadRequest(res, 'Datos de actualización inválidos', body.error.flatten());
      }
      try {
        const data = repo.update(scope, params.data.id, body.data);
        if (!data) {
          return res.status(404).json({ error: 'El tag no existe', id: params.data.id });
        }
        res.json({ data });
      } catch (err) {
        if (err instanceof DuplicateTagError) {
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
      if (!repo.remove(scope, parsed.data.id)) {
        return res.status(404).json({ error: 'El tag no existe', id: parsed.data.id });
      }
      res.status(204).end();
    }),
  );

  return router;
}
