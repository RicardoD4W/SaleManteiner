/**
 * Setup global de Vitest.
 * - Extiende `expect` con los matchers de @testing-library/jest-dom.
 * - Limpia mocks/spies después de cada test (aislar estado).
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});