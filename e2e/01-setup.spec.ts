import { expect, test } from '@playwright/test'
import { newVisitor, TOKEN } from './helpers'

test('only requests with the app token get in', async ({ browser, request }) => {
  // A browser without the token sees a locked page, with the right token it gets a cookie and is in.
  const stranger = await newVisitor(browser, {}, { anonymous: true })
  expect((await stranger.page.goto('/settings'))?.status()).toBe(403)
  await expect(stranger.page.getByRole('heading', { name: 'Cockpit' })).toBeVisible()
  expect((await stranger.page.goto('/auth?token=wrong'))?.status()).toBe(403)
  await stranger.page.goto(`/auth?token=${TOKEN}&next=/settings`)
  await expect(stranger.page).toHaveURL(/\/settings$/)
  await expect(stranger.page.getByRole('heading', { name: 'Instellingen' })).toBeVisible()
  await stranger.context.close()

  // API routes answer strangers with 401, and nobody gets in through another host name.
  expect((await request.get('/api/export/metrics.csv')).status()).toBe(401)
  expect((await request.post('/api/daily')).status()).toBe(401)
  expect((await request.get('/', { headers: { Host: 'evil.example:3300', Cookie: `cockpit=${TOKEN}` } })).status()).toBe(403)
})

test('the owner sets a name, and health says what is connected without leaking keys', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/settings')
  await page.getByLabel('Hoe heet je?').fill('Laurens')
  await page.getByRole('button', { name: 'Bewaren' }).click()
  await expect(page.getByRole('status')).toContainText('Bewaard.')
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Laurens')

  const health = await (await request.get('/api/health')).json()
  expect(health).toMatchObject({ ok: true, database: 'memory', github: 'fixtures' })
  expect(JSON.stringify(health)).not.toMatch(/ghp_|github_pat_|e2e-token/)
  await context.close()
})
