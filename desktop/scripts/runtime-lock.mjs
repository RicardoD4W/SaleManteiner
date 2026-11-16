import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function parseSemver(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function satisfiesRange(version, range) {
  const target = parseSemver(version);
  if (!target) return false;
  const spec = String(range).trim();
  if (spec === '' || spec === '*' || spec === 'x') return true;

  const caret = /^\^(.+)$/.exec(spec);
  if (caret) {
    const base = parseSemver(caret[1]);
    if (!base) return false;
    if (compareSemver(target, base) < 0) return false;
    if (base[0] > 0) return target[0] === base[0];
    if (base[1] > 0) return target[0] === 0 && target[1] === base[1];
    return target[0] === 0 && target[1] === 0 && target[2] === base[2];
  }

  const tilde = /^~(.+)$/.exec(spec);
  if (tilde) {
    const base = parseSemver(tilde[1]);
    if (!base) return false;
    if (compareSemver(target, base) < 0) return false;
    return target[0] === base[0] && target[1] === base[1];
  }

  const atLeast = /^>=(.+)$/.exec(spec);
  if (atLeast) {
    const base = parseSemver(atLeast[1]);
    if (!base) return false;
    return compareSemver(target, base) >= 0;
  }

  const exact = parseSemver(spec);
  if (!exact) return false;
  return compareSemver(target, exact) === 0;
}

export function diffRuntimeDependencies(serverDependencies, runtimeDependencies) {
  const server = serverDependencies ?? {};
  const runtime = runtimeDependencies ?? {};
  const missing = [];
  const extra = [];
  const unpinned = [];
  const incompatible = [];

  for (const [name, range] of Object.entries(server)) {
    if (!(name in runtime)) {
      missing.push(name);
      continue;
    }
    const pinned = String(runtime[name]);
    if (!parseSemver(pinned)) {
      unpinned.push(`${name} (${pinned})`);
      continue;
    }
    if (!satisfiesRange(pinned, range)) {
      incompatible.push(`${name}: el runtime fija ${pinned} y el server pide ${range}`);
    }
  }

  for (const name of Object.keys(runtime)) {
    if (!(name in server)) extra.push(name);
  }

  return { missing, extra, unpinned, incompatible };
}

export function verifyNodeRuntime(runtimes, actualVersion, actualSha256) {
  const list = Array.isArray(runtimes) ? runtimes : [];
  const normalized = String(actualVersion ?? '').replace(/^v/, '');
  const allowed = list.map((runtime) => String(runtime.version).replace(/^v/, ''));

  const match = list.find((runtime) => String(runtime.version).replace(/^v/, '') === normalized);
  if (!match) {
    return {
      ok: false,
      reason:
        `la versión de Node ${actualVersion} no está en la lista de runtimes verificados ` +
        `(${allowed.join(', ') || 'vacía'})`,
    };
  }

  const expected = String(match.sha256 ?? '').toLowerCase();
  const actual = String(actualSha256 ?? '').toLowerCase();
  if (expected !== actual) {
    return {
      ok: false,
      reason:
        `el binario de Node ${normalized} no es el verificado ` +
        `(esperado ${expected}, obtenido ${actual})`,
    };
  }

  return { ok: true, runtime: match };
}

export function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function resolvePackagePath(packages, fromPath, name) {
  let base = fromPath;
  for (;;) {
    const candidate = (base ? `${base}/` : '') + `node_modules/${name}`;
    if (packages[candidate]) return candidate;
    if (!base) return null;
    const index = base.lastIndexOf('/node_modules/');
    base = index === -1 ? '' : base.slice(0, index);
  }
}

export function collectRuntimeClosure(packages, workspacePath, dependencyNames) {
  const entries = new Map();
  const queue = dependencyNames.map((name) => [workspacePath, name]);

  while (queue.length) {
    const [from, name] = queue.shift();
    const path = resolvePackagePath(packages, from, name);
    if (!path) {
      throw new Error(`no encuentro ${name} en el lockfile raíz (desde ${from || 'la raíz'})`);
    }
    const entry = packages[path];
    const key = `node_modules/${name}`;
    const existing = entries.get(key);
    if (existing) {
      if (existing.version !== entry.version) {
        throw new Error(
          `la clausura del runtime necesita dos versiones de ${name} ` +
            `(${existing.version} y ${entry.version}): no se puede representar en un árbol plano`,
        );
      }
      continue;
    }
    entries.set(key, entry);
    for (const dependency of Object.keys(entry.dependencies ?? {})) queue.push([path, dependency]);
    for (const dependency of Object.keys(entry.optionalDependencies ?? {})) {
      queue.push([path, dependency]);
    }
  }

  return entries;
}

function copyPackageEntry(entry) {
  const copy = { ...entry };
  delete copy.dev;
  delete copy.peer;
  delete copy.inBundle;
  delete copy.link;
  return copy;
}

export function buildRuntimeArtifacts({
  rootLock,
  workspacePath,
  runtimeName,
  runtimeVersion,
  serverDependencies,
}) {
  const packages = rootLock.packages ?? {};
  const closure = collectRuntimeClosure(packages, workspacePath, Object.keys(serverDependencies));

  const dependencies = {};
  const runtimePackages = {
    '': {
      name: runtimeName,
      version: runtimeVersion,
      dependencies: {},
    },
  };

  for (const name of Object.keys(serverDependencies).sort()) {
    const entry = closure.get(`node_modules/${name}`);
    dependencies[name] = entry.version;
  }

  runtimePackages[''].dependencies = { ...dependencies };

  for (const key of [...closure.keys()].sort()) {
    runtimePackages[key] = copyPackageEntry(closure.get(key));
  }

  return {
    packageJson: {
      name: runtimeName,
      version: runtimeVersion,
      private: true,
      type: 'module',
      dependencies,
    },
    lockfile: {
      name: runtimeName,
      version: runtimeVersion,
      lockfileVersion: 3,
      requires: true,
      packages: runtimePackages,
    },
  };
}

function canonicalEntry(entry) {
  if (entry === null || typeof entry !== 'object') return JSON.stringify(entry);
  if (Array.isArray(entry)) return `[${entry.map(canonicalEntry).join(',')}]`;
  return `{${Object.keys(entry)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalEntry(entry[key])}`)
    .join(',')}}`;
}

export function diffRuntimeLockfiles(expected, actual) {
  const expectedPackages = expected?.packages ?? {};
  const actualPackages = actual?.packages ?? {};
  const problems = [];

  for (const [path, entry] of Object.entries(expectedPackages)) {
    const other = actualPackages[path];
    if (!other) {
      problems.push(`falta ${path}`);
      continue;
    }
    if (other.version !== entry.version) {
      problems.push(`${path}: ${other.version} en vez de ${entry.version}`);
      continue;
    }
    if (entry.integrity && other.integrity !== entry.integrity) {
      problems.push(`${path}: el integrity no coincide`);
      continue;
    }
    if (canonicalEntry(entry) !== canonicalEntry(other)) {
      problems.push(`${path}: la entrada no coincide con el lockfile raíz`);
    }
  }

  for (const path of Object.keys(actualPackages)) {
    if (!(path in expectedPackages)) problems.push(`sobra ${path}`);
  }

  return problems;
}
