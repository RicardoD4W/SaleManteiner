process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'production';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';

const { openDb } = await import('../db/index.js');
const { runMigrations } = await import('../db/migrate.js');
const { createBuysRepo } = await import('../repo/buys-repo.js');
const { createTagsRepo, DuplicateTagError } = await import('../repo/tags-repo.js');
describe('tags repo', () => {
  let db: Database;
  let repo: ReturnType<typeof createTagsRepo>;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    repo = createTagsRepo(db);
  });

  afterEach(() => {
    db.close();
  });

  it('lista vacío cuando no hay tags del ámbito', () => {
    expect(repo.list('buy')).toEqual([]);
  });

  it('crea un tag con su ámbito', () => {
    const tag = repo.create('buy', { name: 'Navidad', color: '#ff0000' });

    expect(tag).toMatchObject({ scope: 'buy', name: 'Navidad', color: '#ff0000' });
    expect(tag.id).toBeGreaterThan(0);
  });

  it('el mismo nombre puede existir en otro ámbito', () => {
    repo.create('buy', { name: 'Navidad', color: '#ff0000' });
    const sold = repo.create('sold', { name: 'Navidad', color: '#00ff00' });

    expect(sold.scope).toBe('sold');
    expect(repo.list('buy')).toHaveLength(1);
    expect(repo.list('sold')).toHaveLength(1);
  });

  it('el nombre duplicado en el mismo ámbito lanza DuplicateTagError', () => {
    repo.create('buy', { name: 'Navidad', color: '#ff0000' });

    expect(() => repo.create('buy', { name: 'navidad', color: '#00ff00' })).toThrow(
      DuplicateTagError,
    );
  });

  it('actualiza nombre y color', () => {
    const tag = repo.create('buy', { name: 'Navidad', color: '#ff0000' });

    const updated = repo.update('buy', tag.id, { color: '#00ff00' });

    expect(updated).toMatchObject({ name: 'Navidad', color: '#00ff00' });
  });

  it('actualizar a un nombre duplicado lanza DuplicateTagError', () => {
    repo.create('buy', { name: 'Navidad', color: '#ff0000' });
    const other = repo.create('buy', { name: 'Rebajas', color: '#0000ff' });

    expect(() => repo.update('buy', other.id, { name: 'Navidad' })).toThrow(DuplicateTagError);
  });

  it('actualizar un tag de otro ámbito devuelve null', () => {
    const tag = repo.create('buy', { name: 'Navidad', color: '#ff0000' });

    expect(repo.update('sold', tag.id, { color: '#00ff00' })).toBeNull();
  });

  it('eliminar un tag desasigna sus compras y no las borra', () => {
    const buys = createBuysRepo(db);
    const tag = repo.create('buy', { name: 'Navidad', color: '#ff0000' });
    const buy = buys.create({
      product_name: 'Camiseta',
      purchase_cost: 10,
      quantity: 1,
      associated_costs: 0,
      tag_id: tag.id,
    });

    expect(repo.remove('buy', tag.id)).toBe(true);

    const found = buys.getById(buy.id);
    expect(found).not.toBeNull();
    expect(found?.tag).toBeNull();
  });

  it('eliminar un tag inexistente devuelve false', () => {
    expect(repo.remove('buy', 9999)).toBe(false);
  });

  it('lista con buy_count: cuántas compras usan cada tag', () => {
    const buys = createBuysRepo(db);
    const navidad = repo.create('buy', { name: 'Navidad', color: '#ff0000' });
    const rebajas = repo.create('buy', { name: 'Rebajas', color: '#0000ff' });
    buys.create({
      product_name: 'A',
      purchase_cost: 1,
      quantity: 1,
      associated_costs: 0,
      tag_id: navidad.id,
    });
    buys.create({
      product_name: 'B',
      purchase_cost: 1,
      quantity: 1,
      associated_costs: 0,
      tag_id: navidad.id,
    });
    buys.create({
      product_name: 'C',
      purchase_cost: 1,
      quantity: 1,
      associated_costs: 0,
      tag_id: rebajas.id,
    });

    const list = repo.list('buy');

    expect(list.map((t) => [t.name, t.buy_count])).toEqual([
      ['Navidad', 2],
      ['Rebajas', 1],
    ]);
  });
});
