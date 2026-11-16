import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildRuntimeArtifacts,
  diffRuntimeDependencies,
  diffRuntimeLockfiles,
  satisfiesRange,
  verifyNodeRuntime,
} from '../runtime-lock.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.resolve(HERE, '../..');
const REPO = path.resolve(DESKTOP, '..');

const rootLock = JSON.parse(readFileSync(path.join(REPO, 'package-lock.json'), 'utf8'));
const serverPackage = JSON.parse(
  readFileSync(path.join(REPO, 'server', 'package.json'), 'utf8'),
);
const runtimePackage = JSON.parse(
  readFileSync(path.join(DESKTOP, 'runtime', 'package.json'), 'utf8'),
);
const runtimeLock = JSON.parse(
  readFileSync(path.join(DESKTOP, 'runtime', 'package-lock.json'), 'utf8'),
);
const nodePin = JSON.parse(
  readFileSync(path.join(DESKTOP, 'runtime', 'node-runtime.json'), 'utf8'),
);

describe('satisfiesRange', () => {
  it('acepta un rango caret dentro del major', () => {
    expect(satisfiesRange('13.0.3', '^13.0.3')).toBe(true);
    expect(satisfiesRange('13.4.0', '^13.0.3')).toBe(true);
    expect(satisfiesRange('14.0.0', '^13.0.3')).toBe(false);
    expect(satisfiesRange('12.9.9', '^13.0.3')).toBe(false);
  });

  it('acepta un rango tilde dentro del minor', () => {
    expect(satisfiesRange('2.8.6', '~2.8.0')).toBe(true);
    expect(satisfiesRange('2.9.0', '~2.8.0')).toBe(false);
  });

  it('acepta una versión exacta y un mínimo', () => {
    expect(satisfiesRange('5.3.0', '5.3.0')).toBe(true);
    expect(satisfiesRange('5.3.1', '5.3.0')).toBe(false);
    expect(satisfiesRange('5.3.1', '>=5.3.0')).toBe(true);
  });

  it('rechaza lo que no entiende', () => {
    expect(satisfiesRange('5.3.0', 'workspace:*')).toBe(false);
    expect(satisfiesRange('5.3.0', 'latest')).toBe(false);
  });
});

describe('diffRuntimeDependencies', () => {
  it('no encuentra problemas cuando el runtime fija lo que pide el server', () => {
    const drift = diffRuntimeDependencies(
      { express: '^5.3.0', zod: '^4.6.7' },
      { express: '5.3.0', zod: '4.6.7' },
    );
    expect(drift).toEqual({ missing: [], extra: [], unpinned: [], incompatible: [] });
  });

  it('detecta lo que falta, lo que sobra y lo que no está pineado', () => {
    const drift = diffRuntimeDependencies(
      { express: '^5.3.0', zod: '^4.6.7' },
      { express: '^5.3.0', pino: '10.4.0' },
    );
    expect(drift.missing).toEqual(['zod']);
    expect(drift.extra).toEqual(['pino']);
    expect(drift.unpinned).toEqual(['express (^5.3.0)']);
  });

  it('detecta una versión que no cumple el rango del server', () => {
    const drift = diffRuntimeDependencies({ express: '^5.3.0' }, { express: '4.21.0' });
    expect(drift.incompatible).toHaveLength(1);
    expect(drift.incompatible[0]).toContain('express');
  });
});

describe('verifyNodeRuntime', () => {
  const runtimes = [{ version: '22.23.5', sha256: 'a'.repeat(64) }];

  it('acepta la versión con el checksum esperado', () => {
    const result = verifyNodeRuntime(runtimes, 'v22.23.5', 'A'.repeat(64));
    expect(result.ok).toBe(true);
    expect(result.runtime.version).toBe('22.23.5');
  });

  it('rechaza una versión que no está en la lista verificada', () => {
    const result = verifyNodeRuntime(runtimes, 'v20.11.0', 'a'.repeat(64));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('no está en la lista');
  });

  it('rechaza un binario cuyo checksum no es el verificado', () => {
    const result = verifyNodeRuntime(runtimes, '22.23.5', 'b'.repeat(64));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('no es el verificado');
  });
});

describe('el runtime empaquetado', () => {
  it('está pineado con versiones exactas de las dependencias del server', () => {
    for (const [name, range] of Object.entries(serverPackage.dependencies)) {
      expect(runtimePackage.dependencies[name]).toMatch(/^\d+\.\d+\.\d+$/);
      expect(satisfiesRange(runtimePackage.dependencies[name], range)).toBe(true);
    }
  });

  it('tiene el mismo árbol de dependencias que el lockfile raíz del repo', () => {
    const expected = buildRuntimeArtifacts({
      rootLock,
      workspacePath: 'server',
      runtimeName: runtimePackage.name,
      runtimeVersion: runtimePackage.version,
      serverDependencies: serverPackage.dependencies,
    });
    expect(diffRuntimeLockfiles(expected.lockfile, runtimeLock)).toEqual([]);
  });

  it('no se aparta ni un paquete de la clausura que pide el server', () => {
    const closure = new Set(
      Object.keys(runtimeLock.packages).filter((name) => name.startsWith('node_modules/')),
    );
    for (const name of Object.keys(serverPackage.dependencies)) {
      expect(closure.has(`node_modules/${name}`)).toBe(true);
    }
  });
});

describe('la lista de runtimes de node verificados', () => {
  it('tiene versión, checksum y origen para cada runtime', () => {
    expect(nodePin.runtimes.length).toBeGreaterThan(0);
    for (const runtime of nodePin.runtimes) {
      expect(runtime.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(runtime.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(runtime.source).toContain('nodejs.org/dist');
    }
  });

  it('no repite versión ni checksum', () => {
    const versions = nodePin.runtimes.map((runtime) => runtime.version);
    const hashes = nodePin.runtimes.map((runtime) => runtime.sha256);
    expect(new Set(versions).size).toBe(versions.length);
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
