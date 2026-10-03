import { expect, test } from '@playwright/test'
import { newVisitor, signInOwner } from './helpers'

// Runs last: projects exist. AI_FIXTURES=1 and GITHUB_FIXTURES=1.
test('the daily job only runs with the secret, and syncs, checks and makes quests', async ({ request }) => {
  expect((await request.get('/api/cron/daily')).status()).toBe(401)
  expect((await request.get('/api/cron/daily', { headers: { Authorization: 'Bearer wrong' } })).status()).toBe(401)
  const res = await request.get('/api/cron/daily', { headers: { Authorization: 'Bearer e2e-cron' } })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.owners).toBe(1)
  expect(body.report[0].github.failed).toBe(0)
})

test('the weekly focus looks at the whole portfolio and suggests a boss', async ({ browser }) => {
  const { context, page } = await newVisitor(browser)
  await signInOwner(page)
  await expect(page.getByRole('heading', { name: 'Focus van de week' })).toBeVisible()
  await page.getByRole('button', { name: /Maak de weekfocus/ }).click()
  await expect(page.getByText('Deze week: Rondje op straat, de rest op een laag pitje.')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Maak er de boss van' }).click()
  await expect(page.getByText('Boss staat erop')).toBeVisible()
  await page.goto('/quests')
  await expect(page.locator('.quest.boss').filter({ hasText: 'Organiseer de eerste groepswandeling' })).toBeVisible()
  await context.close()
})
