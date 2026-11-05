import { Router, raw } from 'express';
import type { BackupService } from '../backup/backup-service.js';
import { BackupNotFoundError, InvalidBackupError } from '../backup/backup-service.js';
import { asyncHandler } from './_shared.js';

export interface BackupsRouterDeps {
  service: BackupService;
}

const MAX_UPLOAD_BYTES = '512mb';

function nameParam(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

export function backupsRouter(deps: BackupsRouterDeps): Router {
  const { service } = deps;
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      res.json({ data: service.list() });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (_req, res) => {
      res.status(201).json({ data: service.create() });
    }),
  );

  router.post(
    '/restore',
    raw({ type: 'application/octet-stream', limit: MAX_UPLOAD_BYTES }),
    asyncHandler(async (req, res) => {
      const buffer = Buffer.isBuffer(req.body) ? req.body : null;
      if (!buffer || buffer.length === 0) {
        return res.status(400).json({ error: 'No se ha recibido el archivo de la copia' });
      }
      const originalName = (req.get('x-filename') ?? 'copia.db').replace(/[^A-Za-z0-9._-]/g, '_');
      try {
        const data = service.restoreFromBuffer(buffer, originalName);
        res.json({ data });
      } catch (err) {
        if (err instanceof InvalidBackupError) {
          return res.status(400).json({ error: err.message });
        }
        if (err instanceof BackupNotFoundError) {
          return res.status(404).json({ error: err.message });
        }
        throw err;
      }
    }),
  );

  router.post(
    '/:name/restore',
    asyncHandler(async (req, res) => {
      try {
        const data = service.restoreFromStored(nameParam(req.params.name));
        res.json({ data });
      } catch (err) {
        if (err instanceof InvalidBackupError) {
          return res.status(400).json({ error: err.message });
        }
        if (err instanceof BackupNotFoundError) {
          return res.status(404).json({ error: err.message });
        }
        throw err;
      }
    }),
  );

  router.get(
    '/:name/download',
    asyncHandler(async (req, res) => {
      try {
        const name = nameParam(req.params.name);
        if (!service.exists(name)) {
          return res.status(404).json({ error: `La copia "${name}" no existe` });
        }
        const path = service.pathOf(name);
        res.download(path, name);
      } catch (err) {
        if (err instanceof InvalidBackupError) {
          return res.status(400).json({ error: err.message });
        }
        if (err instanceof BackupNotFoundError) {
          return res.status(404).json({ error: err.message });
        }
        throw err;
      }
    }),
  );

  router.delete(
    '/:name',
    asyncHandler(async (req, res) => {
      try {
        service.remove(nameParam(req.params.name));
        res.status(204).end();
      } catch (err) {
        if (err instanceof InvalidBackupError) {
          return res.status(400).json({ error: err.message });
        }
        if (err instanceof BackupNotFoundError) {
          return res.status(404).json({ error: err.message });
        }
        throw err;
      }
    }),
  );

  return router;
}
