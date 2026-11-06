import { describe, expect, it } from 'vitest';
import { buildReleaseBody, extractChangelogSection } from '../release.mjs';

const CHANGELOG = `# Changelog

## [1.0.0]

**Sin publicar**

### Añadido

- Una cosa nueva.

### Corregido

- Un fallo corregido.

## [0.1.1]

**Publicada el 2026-10-26**

- Lo de la 0.1.1.

[1.0.0]: https://github.com/x/releases/tag/v1.0.0
[0.1.1]: https://github.com/x/releases/tag/v0.1.1
`;

describe('extractChangelogSection', () => {
  it('devuelve solo la sección de la versión pedida', () => {
    const section = extractChangelogSection(CHANGELOG, '1.0.0');
    expect(section).toContain('### Añadido');
    expect(section).toContain('- Un fallo corregido.');
    expect(section).not.toContain('Lo de la 0.1.1');
  });

  it('devuelve null si la versión no está en el changelog', () => {
    expect(extractChangelogSection(CHANGELOG, '9.9.9')).toBeNull();
  });
});

describe('buildReleaseBody', () => {
  it('usa la sección de la versión como cuerpo de la release', () => {
    const body = buildReleaseBody(CHANGELOG, '1.0.0');
    expect(body).toContain('- Una cosa nueva.');
    expect(body).toContain('- Un fallo corregido.');
    expect(body).not.toContain('## [1.0.0]');
  });

  it('quita el marcador de sin publicar', () => {
    expect(buildReleaseBody(CHANGELOG, '1.0.0')).not.toContain('Sin publicar');
  });

  it('devuelve null si la versión no está en el changelog', () => {
    expect(buildReleaseBody(CHANGELOG, '9.9.9')).toBeNull();
  });
});
