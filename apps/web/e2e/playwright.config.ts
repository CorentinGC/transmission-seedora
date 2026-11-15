import { defineConfig, devices } from '@playwright/test';

/**
 * e2e smoke suite: the web app against a fake Transmission daemon. Run with `npm run test:e2e`.
 * Uses Playwright's own bundled Chromium (`npx playwright install chromium`), never the user's browser.
 * `SEEDORA_ALLOW_PRIVATE_HOSTS` + `SEEDORA_ALLOWED_HOSTS` let the server reach the daemon on loopback only.
 */
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3199);
const DAEMON_PORT = Number(process.env.FAKE_DAEMON_PORT ?? 19091);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node --experimental-strip-types --no-warnings apps/web/e2e/fake-transmission.ts',
      cwd: '../../..',
      env: { FAKE_DAEMON_PORT: String(DAEMON_PORT) },
      port: DAEMON_PORT,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev:web -- -H 127.0.0.1',
      cwd: '../../..',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        SEEDORA_ALLOW_PRIVATE_HOSTS: 'true',
        SEEDORA_ALLOWED_HOSTS: `127.0.0.1:${DAEMON_PORT}`,
        PORT: String(WEB_PORT),
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
