import { describe, expect, it, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { hasUserData } from '../db/probe.js';
import { canonicalDataDir, resolveDbPath } from '../db/resolve-path.js';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'salemanteiner-db-path-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function createDb(dbPath: string, buys = 0): void {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE buys (id INTEGER PRIMARY KEY, product_name TEXT NOT NULL);
    CREATE TABLE solds (id INTEGER PRIMARY KEY);
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE sale_items (sold_id INTEGER, buy_id INTEGER);
  `);
  const insert = db.prepare('INSERT INTO buys (product_name) VALUES (?)');
  for (let i = 0; i < buys; i++) insert.run(`product-${i}`);
  db.close();
}

function probeFor(dbsWithData: string[]): (dbPath: string) => boolean {
  return (dbPath) => dbsWithData.includes(dbPath);
}

const FAKE_HOME = join(sep(), 'home', 'tester');
const FAKE_APPDATA = join(sep(), 'home', 'tester', 'AppData', 'Roaming');

function sep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}

describe('canonicalDataDir', () => {
  it('en Windows usa %APPDATA%\\SaleManteiner', () => {
    expect(
      canonicalDataDir({
        env: { APPDATA: FAKE_APPDATA },
        home: FAKE_HOME,
        platform: 'win32',
      }),
    ).toBe(join(FAKE_APPDATA, 'SaleManteiner'));
  });

  it('en Windows sin APPDATA usa LOCALAPPDATA', () => {
    const local = join(sep(), 'home', 'tester', 'AppData', 'Local');
    expect(
      canonicalDataDir({ env: { LOCALAPPDATA: local }, home: FAKE_HOME, platform: 'win32' }),
    ).toBe(join(local, 'SaleManteiner'));
  });

  it('en macOS usa ~/Library/Application Support/SaleManteiner', () => {
    expect(canonicalDataDir({ env: {}, home: FAKE_HOME, platform: 'darwin' })).toBe(
      join(FAKE_HOME, 'Library', 'Application Support', 'SaleManteiner'),
    );
  });

  it('en Linux usa XDG_DATA_HOME cuando está', () => {
    const xdg = join(sep(), 'xdg', 'data');
    expect(
      canonicalDataDir({ env: { XDG_DATA_HOME: xdg }, home: FAKE_HOME, platform: 'linux' }),
    ).toBe(join(xdg, 'SaleManteiner'));
  });

  it('en Linux sin XDG_DATA_HOME usa ~/.local/share/SaleManteiner', () => {
    expect(canonicalDataDir({ env: {}, home: FAKE_HOME, platform: 'linux' })).toBe(
      join(FAKE_HOME, '.local', 'share', 'SaleManteiner'),
    );
  });
});

describe('resolveDbPath', () => {
  it('SALEMANTEINER_DB manda sobre todo', () => {
    const explicit = join(sep(), 'tmp', 'explicit.db');
    const resolution = resolveDbPath({
      env: { SALEMANTEINER_DB: explicit },
      home: FAKE_HOME,
      platform: 'win32',
      hasData: probeFor([join(FAKE_HOME, '.salemanteiner', 'data.db')]),
    });
    expect(resolution).toEqual({ path: resolve(explicit), source: 'explicit-file' });
  });

  it('SALEMANTEINER_DIR manda sobre todo y no mira la legacy', () => {
    const dir = join(sep(), 'tmp', 'smoke');
    const resolution = resolveDbPath({
      env: { SALEMANTEINER_DIR: dir },
      home: FAKE_HOME,
      platform: 'win32',
      hasData: probeFor([join(FAKE_HOME, '.salemanteiner', 'data.db')]),
    });
    expect(resolution).toEqual({
      path: join(resolve(dir), 'data.db'),
      source: 'explicit-dir',
    });
  });

  it('con datos en la ruta canónica gana la canónica', () => {
    const planned = join(FAKE_APPDATA, 'SaleManteiner', 'data.db');
    const resolution = resolveDbPath({
      env: { APPDATA: FAKE_APPDATA },
      home: FAKE_HOME,
      platform: 'win32',
      hasData: probeFor([planned]),
    });
    expect(resolution).toEqual({ path: planned, source: 'canonical' });
  });

  it('si la canónica está vacía y la legacy tiene datos, usa la legacy', () => {
    const legacy = join(FAKE_HOME, '.salemanteiner', 'data.db');
    const resolution = resolveDbPath({
      env: { APPDATA: FAKE_APPDATA },
      home: FAKE_HOME,
      platform: 'win32',
      hasData: probeFor([legacy]),
    });
    expect(resolution).toEqual({ path: legacy, source: 'legacy' });
  });

  it('si no hay datos en ninguna, usa la canónica', () => {
    const planned = join(FAKE_APPDATA, 'SaleManteiner', 'data.db');
    const resolution = resolveDbPath({
      env: { APPDATA: FAKE_APPDATA },
      home: FAKE_HOME,
      platform: 'win32',
      hasData: probeFor([]),
    });
    expect(resolution).toEqual({ path: planned, source: 'canonical' });
  });

  it('si la canónica no existe y la legacy tiene datos, usa la legacy', () => {
    const legacy = join(FAKE_HOME, '.salemanteiner', 'data.db');
    const resolution = resolveDbPath({
      env: { APPDATA: FAKE_APPDATA },
      home: FAKE_HOME,
      platform: 'win32',
      hasData: (dbPath) => dbPath === legacy,
    });
    expect(resolution).toEqual({ path: legacy, source: 'legacy' });
  });
});

describe('hasUserData', () => {
  it('una ruta que no existe no tiene datos', () => {
    expect(hasUserData(join(tempDir(), 'nada.db'))).toBe(false);
  });

  it('una BD con el esquema pero sin filas no tiene datos', () => {
    const dbPath = join(tempDir(), 'data.db');
    createDb(dbPath);
    expect(hasUserData(dbPath)).toBe(false);
  });

  it('una BD con compras tiene datos', () => {
    const dbPath = join(tempDir(), 'data.db');
    createDb(dbPath, 3);
    expect(hasUserData(dbPath)).toBe(true);
  });

  it('un archivo que no es una BD no tiene datos', () => {
    const dbPath = join(tempDir(), 'data.db');
    rmSync(dbPath, { force: true });
    writeFileSync(dbPath, 'esto no es una base de datos');
    expect(hasUserData(dbPath)).toBe(false);
  });
});

describe('resolveDbPath con el probe real', () => {
  it('usa la legacy cuando la canónica está vacía', () => {
    const home = tempDir();
    const appData = tempDir();
    const canonicalDir = join(appData, 'SaleManteiner');
    mkdirSync(canonicalDir, { recursive: true });
    createDb(join(canonicalDir, 'data.db'));
    const legacyDir = join(home, '.salemanteiner');
    mkdirSync(legacyDir, { recursive: true });
    createDb(join(legacyDir, 'data.db'), 5);

    const resolution = resolveDbPath({
      env: { APPDATA: appData },
      home,
      platform: 'win32',
      hasData: hasUserData,
    });
    expect(resolution).toEqual({ path: join(legacyDir, 'data.db'), source: 'legacy' });
  });

  it('usa la canónica cuando ya tiene datos', () => {
    const home = tempDir();
    const appData = tempDir();
    const canonicalDir = join(appData, 'SaleManteiner');
    mkdirSync(canonicalDir, { recursive: true });
    createDb(join(canonicalDir, 'data.db'), 2);
    const legacyDir = join(home, '.salemanteiner');
    mkdirSync(legacyDir, { recursive: true });
    createDb(join(legacyDir, 'data.db'), 5);

    const resolution = resolveDbPath({
      env: { APPDATA: appData },
      home,
      platform: 'win32',
      hasData: hasUserData,
    });
    expect(resolution).toEqual({ path: join(canonicalDir, 'data.db'), source: 'canonical' });
  });
});
