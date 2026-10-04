import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { planFixture, profileFixture } from '../src/lib/ai/fixtures'
import { mcpCall, mcpTool, newVisitor, shot } from './helpers'

// Runs after 03-projects: Rondje is in the cockpit. Claude Code talks to the cockpit over MCP; here
// the test plays Claude's part, with the fixtures as its answers.
test('Claude Code gets the brief through MCP and hands the profile and the plan back', async ({ browser, request }) => {
  // Without the bearer token there is nothing to talk to.
  const noToken = await request.post('/api/mcp', {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  })
  expect(noToken.status()).toBe(401)

  const tools = (await mcpCall(request, 'tools/list')).result?.tools?.map((t) => t.name) ?? []
  expect(tools).toEqual(
    expect.arrayContaining(['list_projects', 'get_project', 'get_portfolio', 'get_stats', 'get_task', 'save_profile', 'save_plan', 'save_emails', 'save_posts', 'save_ideas', 'save_opportunities', 'save_weekly', 'add_quests', 'list_contacts']),
  )
  const prompts = (await mcpCall(request, 'prompts/list')).result?.prompts?.map((p) => p.name) ?? []
  expect(prompts).toEqual(expect.arrayContaining(['profile', 'plan', 'weekly']))

  // The brief: the rules, the project as data (red lines included), the task, and how to hand it back.
  const brief = await mcpTool(request, 'get_task', { task: 'profile', project: 'rondje' })
  expect(brief.isError).toBe(false)
  expect(brief.text).toContain('<rules>')
  expect(brief.text).toMatch(/Red lines \(never cross these\): \S/)
  expect(brief.text).toContain('Task: the marketing profile of Rondje')
  expect(brief.text).toContain('`save_profile`')
  // An unknown project is a clear error that names the ones it knows.
  const unknown = await mcpTool(request, 'get_task', { task: 'profile', project: 'Nope' })
  expect(unknown.isError).toBe(true)
  expect(unknown.text).toContain('Rondje')

  // Claude hands the profile back; the page shows it, and a quick win becomes a quest.
  const saved = await mcpTool(request, 'save_profile', { project: 'Rondje', profile: profileFixture('Rondje') })
  expect(saved.isError).toBe(false)
  expect(saved.text).toContain('Opgeslagen')
  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await page.getByRole('link', { name: 'Marketingbrein' }).click()
  await expect(page.getByText('Rondje: het rondje dat je week beter maakt.')).toBeVisible()
  await expect(page.getByText(/Eerste stap:/).first()).toBeVisible()
  const win = page.locator('li').filter({ hasText: 'Mail drie opvangen' })
  await win.getByRole('button', { name: '+ quest' }).click()
  await expect(win.getByText('quest')).toBeVisible()

  // "Opnieuw" opens Claude Code with a ticket (the test terminal records the command instead).
  await page.getByRole('button', { name: /Opnieuw/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()
  const launches = readFileSync('test-results/claude-launch.txt', 'utf8').trim().split('\n')
  const last = JSON.parse(launches[launches.length - 1]) as { command: string }
  expect(last.command).toMatch(/^claude --allowedTools mcp__cockpit "Haal met de cockpit-tool get_task de taak met ticket [a-f0-9]{8} op en voer die uit\."$/)
  const ticket = last.command.match(/ticket ([a-f0-9]{8})/)![1]
  const byTicket = await mcpTool(request, 'get_task', { ticket })
  expect(byTicket.isError).toBe(false)
  expect(byTicket.text).toContain('Task: the marketing profile of Rondje')
  expect((await mcpTool(request, 'get_task', { ticket: 'deadbeef' })).isError).toBe(true)

  // The plan builds on the profile; chosen actions become quests in their week.
  const plan = await mcpTool(request, 'save_plan', { project: 'Rondje', plan: planFixture() })
  expect(plan.isError).toBe(false)
  await page.reload()
  await expect(page.getByText('Mail vijf opvangen met de pitch')).toBeVisible()
  await shot(page, '08-brain')
  await page.getByRole('checkbox', { name: 'Mail vijf opvangen met de pitch' }).check()
  await page.getByRole('checkbox', { name: 'Organiseer een eerste groepswandeling' }).check()
  await page.getByRole('button', { name: '2 als quest zetten' }).click()
  await expect(page.getByText('2 quests toegevoegd.')).toBeVisible()

  await page.goto('/quests')
  await expect(page.getByText('Mail vijf opvangen met de pitch')).toBeVisible()
  await expect(page.getByText('Organiseer een eerste groepswandeling')).toBeVisible()
  await expect(page.getByText('Mail drie opvangen', { exact: true })).toBeVisible()
  await expect(page.getByText('Plan gemaakt').first()).toBeVisible()

  // Claude can also put quests on the list itself, and read his stats for a word of coaching.
  const added = await mcpTool(request, 'add_quests', { project: 'Rondje', quests: [{ title: 'Bel de opvang in Leiden', xp: 10 }] })
  expect(added.text).toContain('1 quest toegevoegd')
  const stats = JSON.parse((await mcpTool(request, 'get_stats')).text) as { level: number; totalXp: number }
  expect(stats.level).toBeGreaterThanOrEqual(1)
  expect(stats.totalXp).toBeGreaterThan(0)
  await context.close()
})
