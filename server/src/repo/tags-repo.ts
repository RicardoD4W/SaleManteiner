import type { Database } from 'better-sqlite3';
import type {
  CreateTagInput,
  Tag,
  TagScope,
  TagWithCount,
  UpdateTagInput,
} from '../schemas/tags.js';

export class DuplicateTagError extends Error {
  readonly error = 'Ya existe un tag con ese nombre';
  constructor() {
    super('Ya existe un tag con ese nombre');
    this.name = 'DuplicateTagError';
  }
}

export class UnknownTagError extends Error {
  readonly error = 'El tag no existe';
  constructor() {
    super('El tag no existe');
    this.name = 'UnknownTagError';
  }
}

export interface TagsRepo {
  list(scope: TagScope): TagWithCount[];
  getById(scope: TagScope, id: number): Tag | null;
  create(scope: TagScope, input: CreateTagInput): Tag;
  update(scope: TagScope, id: number, input: UpdateTagInput): Tag | null;
  remove(scope: TagScope, id: number): boolean;
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed');
}

export function createTagsRepo(db: Database): TagsRepo {
  const insertStmt = db.prepare(
    'INSERT INTO tags (scope, name, color, created_at) VALUES (?, ?, ?, ?)',
  );
  const getStmt = db.prepare('SELECT * FROM tags WHERE id = ? AND scope = ?');
  const updateStmt = db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND scope = ?');
  const deleteStmt = db.prepare('DELETE FROM tags WHERE id = ? AND scope = ?');
  const listStmt = db.prepare(`
    SELECT t.id, t.scope, t.name, t.color, t.created_at,
      (SELECT COUNT(*) FROM buys b WHERE b.tag_id = t.id) AS buy_count
    FROM tags t
    WHERE t.scope = ?
    ORDER BY t.name COLLATE NOCASE
  `);

  function list(scope: TagScope): TagWithCount[] {
    return listStmt.all(scope) as TagWithCount[];
  }

  function getById(scope: TagScope, id: number): Tag | null {
    const row = getStmt.get(id, scope) as Tag | undefined;
    return row ?? null;
  }

  function create(scope: TagScope, input: CreateTagInput): Tag {
    const now = new Date().toISOString();
    try {
      const result = insertStmt.run(scope, input.name, input.color, now);
      return getStmt.get(Number(result.lastInsertRowid), scope) as Tag;
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new DuplicateTagError();
      throw err;
    }
  }

  function update(scope: TagScope, id: number, input: UpdateTagInput): Tag | null {
    const existing = getById(scope, id);
    if (!existing) return null;
    try {
      updateStmt.run(input.name ?? existing.name, input.color ?? existing.color, id, scope);
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new DuplicateTagError();
      throw err;
    }
    return getById(scope, id);
  }

  function remove(scope: TagScope, id: number): boolean {
    return deleteStmt.run(id, scope).changes > 0;
  }

  return { list, getById, create, update, remove };
}
