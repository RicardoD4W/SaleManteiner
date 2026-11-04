import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { CreateBuyInput } from '../schemas/buys.js';

const CreateSchema = CreateBuyInput;

function createBuy(repo: ReturnType<typeof createBuysRepo>, product_name: string) {
  return repo.create(CreateSchema.parse({ product_name }));
}

describe('nombres de producto', () => {
  let db: Database;
  let repo: ReturnType<typeof createBuysRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = createBuysRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  it('devuelve un nombre por cada producto distinto de las compras', () => {
    createBuy(repo, 'iPhone 12');
    createBuy(repo, 'Funda');
    createBuy(repo, 'iPhone 12');

    expect(repo.listProductNames()).toEqual([
      { name: 'iPhone 12', uses: 2 },
      { name: 'Funda', uses: 1 },
    ]);
  });

  it('agrupa sin distinguir mayúsculas y devuelve la grafía más reciente', () => {
    createBuy(repo, 'iphone 12');
    createBuy(repo, 'iPhone 12');
    createBuy(repo, 'IPHONE 12');

    const names = repo.listProductNames();

    expect(names).toHaveLength(1);
    expect(names[0].name).toBe('IPHONE 12');
    expect(names[0].uses).toBe(3);
  });

  it('ordena por número de usos y, a igualdad, por uso más reciente', () => {
    createBuy(repo, 'A');
    createBuy(repo, 'B');
    createBuy(repo, 'B');
    createBuy(repo, 'C');
    createBuy(repo, 'C');

    expect(repo.listProductNames().map((p) => p.name)).toEqual(['C', 'B', 'A']);
  });

  it('devuelve una lista vacía cuando no hay compras', () => {
    expect(repo.listProductNames()).toEqual([]);
  });
});
