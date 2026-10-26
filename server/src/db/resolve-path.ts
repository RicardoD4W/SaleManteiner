import path from 'node:path';

export type DbPathSource = 'explicit-file' | 'explicit-dir' | 'canonical' | 'legacy';

export interface DbPathOptions {
  env: NodeJS.ProcessEnv;
  home: string;
  platform: NodeJS.Platform;
  hasData: (dbPath: string) => boolean;
}

export interface DbPathResolution {
  path: string;
  source: DbPathSource;
}

export function canonicalDataDir(options: {
  env: NodeJS.ProcessEnv;
  home: string;
  platform: NodeJS.Platform;
}): string {
  const { env, home, platform } = options;
  if (platform === 'win32') {
    const appData = env.APPDATA?.trim();
    if (appData) return path.join(appData, 'SaleManteiner');
    return path.join(home, 'AppData', 'Roaming', 'SaleManteiner');
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'SaleManteiner');
  }
  const xdg = env.XDG_DATA_HOME;
  const base = xdg && xdg.trim() ? xdg : path.join(home, '.local', 'share');
  return path.join(base, 'SaleManteiner');
}

export function resolveDbPath(options: DbPathOptions): DbPathResolution {
  const { env, home, platform, hasData } = options;
  const explicitFile = env.SALEMANTEINER_DB?.trim();
  if (explicitFile) return { path: path.resolve(explicitFile), source: 'explicit-file' };
  const explicitDir = env.SALEMANTEINER_DIR?.trim();
  if (explicitDir) {
    return { path: path.join(path.resolve(explicitDir), 'data.db'), source: 'explicit-dir' };
  }
  const planned = path.join(canonicalDataDir({ env, home, platform }), 'data.db');
  const legacy = path.join(home, '.salemanteiner', 'data.db');
  if (!hasData(planned) && hasData(legacy)) return { path: legacy, source: 'legacy' };
  return { path: planned, source: 'canonical' };
}
