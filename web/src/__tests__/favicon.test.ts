/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = resolve(webRoot, '..');

describe('web favicon', () => {
  it('links a favicon whose file exists in web/public', () => {
    const html = readFileSync(resolve(webRoot, 'index.html'), 'utf8');
    const links = [...html.matchAll(/<link\b[^>]*rel=["']icon["'][^>]*>/g)].map(
      (match) => match[0],
    );

    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      const href = link.match(/href=["']([^"']+)["']/)?.[1];
      expect(href).toBeDefined();

      const target = href!.startsWith('/')
        ? resolve(webRoot, 'public', href!.replace(/^\/+/, ''))
        : resolve(repoRoot, href!.replace(/^\.\//, ''));

      expect(existsSync(target)).toBe(true);
    }
  });

  it('links the png favicon generated from the desktop icon source', () => {
    const html = readFileSync(resolve(webRoot, 'index.html'), 'utf8');
    const link = html.match(/<link\b[^>]*rel=["']icon["'][^>]*>/)?.[0] ?? '';

    expect(link).toContain('href="/favicon.png"');
    expect(link).toContain('type="image/png"');
    expect(existsSync(resolve(webRoot, 'public/favicon.png'))).toBe(true);
  });
});
