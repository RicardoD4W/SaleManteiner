import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';

const E2E_API_PORT = 4100;
const E2E_WEB_PORT = 5174;
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
