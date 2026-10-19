import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
import { CHRONOS_PORT, chronosEnv, chronosUrl, IRIS_PORT } from './test-env';

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  forbidOnly: Boolean(process.env.CI),
  // One worker: the specs share the seeded database, so determinism beats
  // parallelism in a suite this size.
  fullyParallel: false,
  globalSetup: './global-setup.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['list']],
  retries: process.env.CI ? 1 : 0,
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${IRIS_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'bun run dev',
      cwd: '../chronos',
      env: chronosEnv,
      port: CHRONOS_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // vite's `server.port` (3000) is for local dev; the suite pins its own
      // port on the command line and points the /api proxy at the booted
      // Chronos via IRIS_API_ORIGIN.
      command: 'bun --bun vite --port 3210 --strictPort',
      cwd: '../iris',
      env: {
        IRIS_API_ORIGIN: chronosUrl,
        VITE_API_ORIGIN: chronosUrl,
      },
      port: IRIS_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  workers: 1,
});
