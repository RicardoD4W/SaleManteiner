/**
 * Configuración de Playwright para la VERIFICACIÓN VISUAL.
 *
 * Es sister de `playwright.config.ts` (la del e2e), pero no asserta: su
 * trabajo es dejar capturas de pantalla de las pantallas clave para que un
 * humano (o un agente con ojos) pueda MIRAR cómo quedó la app.
 *
 * Por qué un config aparte y no un spec más del e2e:
 *  - Las capturas no son un test: no deben fallar la CI ni el `npm run e2e`.
 *  - El e2e usa los puertos 4100/5174; la verificación visual usa 4200/5200
 *    para poder convivir con una corrida de e2e.
 *
 * Igual que el e2e, levanta su propio backend y su propio Vite con una BD
 * **temporal**: nunca toca la BD real del usuario (`~/.salemanteiner`).
 *
 * Uso: `npm run visual -w web` → deja las capturas en `web/visual/shots/`.
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';

/** Puerto del backend aislado de la verificación visual. */
const VISUAL_API_PORT = 4200;
/** Puerto del Vite de la verificación visual. */
const VISUAL_WEB_PORT = 5200;
/** BD temporal (nunca la del usuario). */
const VISUAL_DB_DIR = path.join(os.tmpdir(), 'salemanteiner-visual');

export default defineConfig({
  testDir: './visual',
  outputDir: './visual/.output',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${VISUAL_WEB_PORT}`,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --workspace ../server run dev',
      port: VISUAL_API_PORT,
      env: {
        PORT: String(VISUAL_API_PORT),
        SALEMANTEINER_DIR: VISUAL_DB_DIR,
      },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --port ${VISUAL_WEB_PORT} --strictPort false`,
      port: VISUAL_WEB_PORT,
      env: {
        API_TARGET: `http://127.0.0.1:${VISUAL_API_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
