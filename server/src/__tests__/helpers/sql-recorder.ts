import type { Database } from 'better-sqlite3';

export interface SqlEvent {
  sql: string;
  params: unknown[];
}

export interface SqlRecorder {
  db: Database;
  prepared: string[];
  executed: SqlEvent[];
  reset(): void;
}

export function recordSql(db: Database): SqlRecorder {
  const prepared: string[] = [];
  const executed: SqlEvent[] = [];
  const originalPrepare = db.prepare.bind(db);

  const patchedPrepare = (sql: string) => {
    prepared.push(sql);
    const statement = originalPrepare(sql);
    return new Proxy(statement, {
      get(target, property) {
        const value: unknown = Reflect.get(target, property, target);
        if (property !== 'all' && property !== 'get' && property !== 'run') {
          return typeof value === 'function' ? value.bind(target) : value;
        }
        const call = value as (...params: unknown[]) => unknown;
        return (...args: unknown[]) => {
          const result = call.apply(target, args);
          executed.push({ sql, params: args });
          return result;
        };
      },
    });
  };

  const recorder: SqlRecorder = {
    db: new Proxy(db, {
      get(target, property) {
        if (property === 'prepare') return patchedPrepare;
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
    prepared,
    executed,
    reset() {
      prepared.length = 0;
      executed.length = 0;
    },
  };

  return recorder;
}

export function findEvent(recorder: SqlRecorder, matches: (sql: string) => boolean): SqlEvent {
  const event = recorder.executed.find((candidate) => matches(candidate.sql));
  if (!event) throw new Error('No se ejecutó ninguna consulta que case con el patrón');
  return event;
}

export function planOf(db: Database, sql: string, params: unknown[]): string[] {
  const rows = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as Array<{ detail: string }>;
  return rows.map((row) => row.detail);
}
