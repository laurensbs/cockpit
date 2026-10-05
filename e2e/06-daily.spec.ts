import { expect, test } from '@playwright/test'
import { weeklyFixture } from '../src/lib/ai/fixtures'
import { mcpTool, newVisitor, TOKEN, openMore } from './helpers'

// Runs last: projects exist. GITHUB_FIXTURES=1.
test('the daily round runs with the app token, and syncs, checks and makes quests', async ({ request }) => {
  expect((await request.post('/api/daily', { headers: { Authorization: 'Bearer wrong' } })).status()).toBe(401)
  const res = await request.post('/api/daily', { headers: { Authorization: `Bearer ${TOKEN}` } })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(body.github.failed).toBe(0)
})

test('the weekly focus from Claude Code looks at the whole portfolio and suggests a boss', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/')
  await openMore(page)
  await expect(page.getByRole('heading', { name: 'Focus van de week' })).toBeVisible()
  await page.getByRole('button', { name: /Maak de weekfocus/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()

  const portfolio = await mcpTool(request, 'get_portfolio')
  expect(portfolio.text).toContain('This is his whole portfolio')
  const saved = await mcpTool(request, 'save_weekly', { weekly: weeklyFixture() })
  expect(saved.text).toContain('Opgeslagen')
  await page.reload()
  await openMore(page)
  await expect(page.getByText('Deze week: Rondje op straat, de rest op een laag pitje.')).toBeVisible()
  await page.getByRole('button', { name: 'Maak er de boss van' }).click()
  await expect(page.getByText('Boss staat erop')).toBeVisible()
  await page.goto('/quests')
  await expect(page.locator('.quest.boss').filter({ hasText: 'Organiseer de eerste groepswandeling' })).toBeVisible()
  await context.close()
})
