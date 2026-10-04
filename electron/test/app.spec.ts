import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

// The app starts the standalone server with a token of its own, puts the cookie on its window and
// opens the cockpit. Needs the build, release/server and dist-electron (see the config's comment).
test('the app starts its own server and opens the cockpit', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'cockpit-'))
  const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    env: { ...process.env, COCKPIT_USER_DATA: userData, GITHUB_FIXTURES: '1' },
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await expect(window).toHaveTitle(/Cockpit/)
  await expect(window.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(window.getByRole('link', { name: 'Projecten' }).first()).toBeVisible()

  // A token of its own, the data in its own folder, the server alive behind it.
  const config = JSON.parse(readFileSync(join(userData, 'config.json'), 'utf8')) as { token: string; port: number }
  expect(config.token.length).toBeGreaterThanOrEqual(32)
  const health = (await window.evaluate(() => fetch('/api/health').then((r) => r.json()))) as { ok: boolean; database: string; github: string }
  expect(health).toMatchObject({ ok: true, database: 'pglite', github: 'fixtures' })
  expect(await window.evaluate(() => location.origin)).toBe(`http://127.0.0.1:${config.port}`)

  // The window can move through the app.
  await window.getByRole('link', { name: 'Projecten' }).first().click()
  await expect(window.getByRole('heading', { name: 'Zet je projecten erin' })).toBeVisible()
  await app.close()
})
