import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

// The app starts the server with a token of its own, puts the cookie on its window and opens the
// cockpit. By default it runs the shell from dist-electron against release/server; with
// COCKPIT_PACKAGED_APP it runs a packaged build (electron-builder --linux dir), so the layout of
// the resources is tested too.
const packaged = process.env.COCKPIT_PACKAGED_APP

test('the app starts its own server and opens the cockpit', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'cockpit-'))
  const env = { ...process.env, COCKPIT_USER_DATA: userData, GITHUB_FIXTURES: '1', COCKPIT_NO_GH: '1', COCKPIT_NO_VERCEL_CLI: '1' }
  const app = packaged
    ? await electron.launch({ executablePath: packaged, args: ['--no-sandbox'], env })
    : await electron.launch({ args: ['.', '--no-sandbox'], env })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await expect(window).toHaveTitle(/Cockpit/)
  await expect(window.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(window.getByRole('link', { name: 'Projecten' }).first()).toBeVisible()

  // A token of its own, the data in its own folder, the server alive behind it. The packaged app
  // never uses test fixtures, whatever the environment says.
  const config = JSON.parse(readFileSync(join(userData, 'config.json'), 'utf8')) as { token: string; port: number }
  expect(config.token.length).toBeGreaterThanOrEqual(32)
  const health = (await window.evaluate(() => fetch('/api/health').then((r) => r.json()))) as { ok: boolean; database: string; github: string }
  expect(health).toMatchObject({ ok: true, database: 'pglite', github: packaged ? 'off' : 'fixtures' })
  expect(await window.evaluate(() => location.origin)).toBe(`http://127.0.0.1:${config.port}`)
  // It can draw slides: the fonts and the WebAssembly made it into the app.
  const render = (await window.evaluate(() => fetch('/api/render/check').then((r) => r.json()))) as { ok: boolean; video: boolean }
  expect(render.ok).toBe(true)
  // A build that brings its own ffmpeg can make videos with it.
  if (packaged && existsSync(join(dirname(packaged), 'resources', 'ffmpeg'))) expect(render.video).toBe(true)

  // The window can move through the app.
  await window.getByRole('link', { name: 'Projecten' }).first().click()
  await expect(window.getByRole('heading', { name: 'Zet je projecten erin' })).toBeVisible()
  await app.close()
})
