import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATION_RE = /^(\d+)_(.+)\.sql$/;

function loadMigrations(): Migration[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => {
      const match = MIGRATION_RE.exec(f);
      if (!match) throw new Error(`Nombre de migración inválido: ${f}`);
      const [, versionStr, name] = match;
      const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf-8');
      return { version: Number(versionStr), name, sql };
    });
}

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedRows = db.prepare('SELECT version FROM _migrations').all() as Array<{
    version: number;
  }>;
  const applied = new Set(appliedRows.map((r) => r.version));

  const insertMigration = db.prepare(
    'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
  );

  const apply = db.transaction((m: Migration) => {
    db.exec(m.sql);
    insertMigration.run(m.version, m.name, new Date().toISOString());
  });

  for (const m of loadMigrations()) {
    if (applied.has(m.version)) continue;
    apply(m);
  }
}
