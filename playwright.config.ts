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
          // The token the tests put in their cookie, as the app window would.
          COCKPIT_TOKEN: 'e2e-token',
          // Fixed answers instead of GitHub: the tests never need a token.
          GITHUB_FIXTURES: '1',
          // "Open in Claude Code" writes the command here instead of opening a terminal.
          COCKPIT_FAKE_TERMINAL: `${process.cwd()}/test-results/claude-launch.txt`,
          // Mails go to a file, at any hour, without the gap between them; the tests run the outbox themselves.
          COCKPIT_FAKE_SMTP: `${process.cwd()}/test-results/smtp.jsonl`,
          COCKPIT_MAIL_ANYTIME: '1',
          COCKPIT_MAIL_GAP_MS: '0',
          COCKPIT_NO_WORKER: '1',
          // Never pick up the GitHub CLI of the machine the tests run on.
          COCKPIT_NO_GH: '1',
          // Stripe, Mollie and Plausible answer from fixtures, relative to today.
          COCKPIT_FAKE_CONNECTORS: '1',
          // CapCut packages go into test-results instead of ~/Movies.
          COCKPIT_CAPCUT_DIR: `${process.cwd()}/test-results/capcut`,
          // Publishing: LinkedIn, Instagram and TikTok answer from fixtures (and write down what was
          // posted), the "Blob store" is a list, and posts may go out at any hour.
          COCKPIT_FIXTURE_LOG: `${process.cwd()}/test-results/fixture-requests.jsonl`,
          COCKPIT_FAKE_BLOB: `${process.cwd()}/test-results/blob.jsonl`,
          COCKPIT_PUBLISH_ANYTIME: '1',
        },
      },
})
