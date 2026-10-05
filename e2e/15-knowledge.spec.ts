import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { mcpTool, newVisitor, TOKEN } from './helpers'

// Runs last: it renames Rondje. Staying up to date: after a push (or a new STAND.md) Claude reads what is
// new and updates the intake, a new name included.

test('after a push Claude updates what the cockpit knows, a new name included, once per change', async ({ browser, request }) => {
  // An earlier daily round read every project with a repo once (a refresh ticket each); nothing new since,
  // so this round starts no refresh.
  const tickets = readFileSync('test-results/claude-launch.txt', 'utf8').match(/ticket [a-f0-9]{8}/g) ?? []
  const briefs = await Promise.all(tickets.map((t) => mcpTool(request, 'get_task', { ticket: t.slice(7) })))
  expect(briefs.some((b) => b.text.includes('keep what the cockpit knows about'))).toBe(true)
  const daily = await (await request.post('/api/daily', { headers: { Authorization: `Bearer ${TOKEN}` } })).json()
  expect(daily.refreshed).toEqual([])

  const brief = await mcpTool(request, 'get_task', { task: 'refresh', project: 'Rondje' })
  expect(brief.text).toContain('keep what the cockpit knows about Rondje up to date')
  expect(brief.text).toContain('A new name only when his own documents say the project was renamed')

  const renamed = await mcpTool(request, 'save_intake', { project: 'Rondje', name: 'Rondje Mee', siteUrl: 'https://rondjemee.example' })
  expect(renamed.text).toContain('Rondje heet nu Rondje Mee')
  expect((await mcpTool(request, 'save_intake', { project: 'Rondje Mee', name: 'Webstability' })).isError).toBe(true)

  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await expect(page.getByRole('link', { name: /Rondje Mee/ }).first()).toBeVisible()
  await context.close()
})
