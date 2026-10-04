import { defineConfig } from '@playwright/test'

/** The app itself: `npm run build && node scripts/standalone.mjs && npm run electron:compile` first. */
export default defineConfig({
  testDir: './electron/test',
  outputDir: './test-results/electron',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
})
