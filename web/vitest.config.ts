import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Configuración de Vitest para `web/`.
 *
 * - environment jsdom: simula el DOM para React Testing Library.
 * - globals false: imports explícitos de describe/it/expect/vi (más prolijo).
 * - alias `@/`: mismo prefijo que ya usa el código (`web/src/`).
 * - setupFiles: importa `@testing-library/jest-dom/vitest` (matchers custom)
 *   y limpia mocks después de cada test.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-utils/setup.ts'],
    css: false,
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
});
