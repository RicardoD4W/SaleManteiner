import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';

/**
 * Configuración de Playwright para los tests E2E del frontend.
 *
 * Decisiones:
 *  - `workers: 1` y `fullyParallel: false`: una sola corrida secuencial. Los
 *    tests comparten una BD (un único backend); limpiar la BD en `beforeEach`
 *    via API es más simple que aislar workers con BDs distintas.
 *  - **Aislamiento del entorno**: los e2e arrancan su propio backend (puerto
 *    4100) y su propio Vite (puerto 5174), con la BD en un directorio
 *    temporal. Antes los tests compartían servidor y BD con la app de
 *    desarrollo, y como el `beforeEach` limpia compras y ventas vía API,
 *    **cada corrida vaciaba la BD real del usuario** (`~/.salemanteiner`).
 *    Ahora `SALEMANTEINER_DIR` apunta a un temporal y `API_TARGET` le dice
 *    al proxy de Vite dónde está ese backend.
 *  - `reuseExistingServer: false`: nunca se reusa un servidor ya levantado
 *    (el del usuario podría estar apuntando a su BD real).
 *  - `trace: 'on-first-retry'`: solo guarda trace si un test falla, para
 *    debug sin inflar el repo.
 */

/** Puerto del backend aislado de los e2e. */
const E2E_API_PORT = 4100;
/** Puerto del Vite de los e2e. */
const E2E_WEB_PORT = 5174;
/** BD temporal de los e2e (nunca la del usuario). */
const E2E_DB_DIR = path.join(os.tmpdir(), 'salemanteiner-e2e');

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${E2E_WEB_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // El backend vive en `server/`. Usamos `--workspace ../server` (path
      // relativo) para que funcione sin importar desde qué cwd se ejecute
      // Playwright (`web/`, monorepo root, CI).
      command: 'npm --workspace ../server run dev',
      port: E2E_API_PORT,
      env: {
        PORT: String(E2E_API_PORT),
        SALEMANTEINER_DIR: E2E_DB_DIR,
      },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --port ${E2E_WEB_PORT}`,
      port: E2E_WEB_PORT,
      env: {
        API_TARGET: `http://127.0.0.1:${E2E_API_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
