import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para los tests E2E del frontend.
 *
 * Decisiones:
 *  - `workers: 1` y `fullyParallel: false`: una sola corrida secuencial. Los
 *    tests comparten una BD (un único backend); limpiar la BD en `beforeEach`
 *    via API es más simple que aislar workers con BDs distintas.
 *  - `webServer` arranca backend (:4000) + Vite dev (:5173) en paralelo.
 *    Vite ya tiene `server.proxy['/api']` apuntando al backend (ver vite.config.ts).
 *  - `reuseExistingServer: !process.env.CI`: en local, si ya hay servers
 *    corriendo, los reusa. En CI siempre arranca fresh.
 *  - `trace: 'on-first-retry'`: solo guarda trace si un test falla, para
 *    debug sin inflar el repo.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
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
      port: 4000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});