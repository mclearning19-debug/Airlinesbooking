import { defineConfig, devices } from '@playwright/test';

// BASE_URL unset: starts the app (npm run dev) on port 3100 and tests http://localhost:3100.
// A dedicated port keeps the suite from attaching to some other dev server already holding 3000.
// BASE_URL set (Render, Azure, ...): tests that deployment; no local server is started.
// Run with: npm run test:e2e   (loads .env for DATABASE_URL, used only for cleanup)
const E2E_PORT = 3100;
const baseURL = process.env.BASE_URL?.replace(/\/$/, '') || `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalTeardown: './tests/e2e/global-teardown.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000, // free hosts cold-start
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        env: { PORT: String(E2E_PORT), HMR_PORT: String(E2E_PORT + 1), BETTER_AUTH_URL: baseURL }, // beat any values in .env
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
