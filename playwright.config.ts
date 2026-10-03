import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3300)

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    locale: 'nl-NL',
    timezoneId: 'Europe/Amsterdam',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    ...(process.env.E2E_DESKTOP ? [{ name: 'desktop', use: { ...devices['Desktop Chrome'], browserName: 'chromium' as const } }] : []),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.E2E_SERVER_CMD ?? `npx next dev --port ${PORT}`,
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: true,
        timeout: 180_000,
        env: {
          PGLITE_DIR: 'memory',
          OWNER_EMAILS: 'owner@e2e.test',
          OWNER_SETUP_CODE: 'e2e-setup-code',
          // Fixed answers instead of Claude and GitHub: the tests never spend money or need a token.
          AI_FIXTURES: '1',
          GITHUB_FIXTURES: '1',
          CRON_SECRET: 'e2e-cron',
          AI_MONTHLY_BUDGET_USD: '10',
        },
      },
})
