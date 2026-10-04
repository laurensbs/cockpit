import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { mcpTool, newVisitor, shot } from './helpers'

// Runs after the others: Rondje and friends are in the cockpit, Claude Code is "connected" (the test
// terminal records what would be opened instead of opening a window).
const launches = () =>
  readFileSync('test-results/claude-launch.txt', 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { command: string })
const lastTicket = () => launches().at(-1)!.command.match(/ticket ([a-f0-9]{8})/)![1]

test('Vandaag: the next step per project, and a free question for Claude through a ticket', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/')
  const next = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nu doen' }) })
  await expect(next.locator('.project-chip').first()).toBeVisible()
  await shot(page, '20-today-smart')

  // He asks about one project; the question travels in the ticket, never in the terminal command.
  await page.getByLabel('Je vraag of opdracht').fill('Waar haal ik de eerste 100 wandelaars vandaan?')
  await page.getByLabel('Over', { exact: true }).selectOption({ label: 'Rondje' })
  await page.getByRole('button', { name: 'Vraag het Claude' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()
  expect(launches().at(-1)!.command).not.toContain('wandelaars')
  const brief = await mcpTool(request, 'get_task', { ticket: lastTicket() })
  expect(brief.isError).toBe(false)
  expect(brief.text).toContain('Task: he asks you something about Rondje')
  expect(brief.text).toContain('Waar haal ik de eerste 100 wandelaars vandaan?')
  expect(brief.text).toContain('Answer him in Dutch')

  // Claude Code can also ask on its own, about everything, without a ticket.
  const all = await mcpTool(request, 'get_task', { task: 'ask', question: 'Welk project verdient deze week aandacht?' })
  expect(all.isError).toBe(false)
  expect(all.text).toContain('Task: he asks you something about his projects')
  expect((await mcpTool(request, 'get_task', { task: 'ask' })).isError).toBe(true)
  await context.close()
})

test('the command bar: Ctrl+K, go anywhere, start a job for a project, or ask', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/')
  const bar = page.getByRole('dialog', { name: 'Zoek of vraag Claude' })
  const input = bar.getByRole('combobox')
  // Ctrl+K works once the page is live; until then a key press can go nowhere, so press again.
  const openBar = () =>
    expect(async () => {
      if (!(await bar.isVisible())) await page.keyboard.press('Control+K')
      await expect(bar).toBeVisible({ timeout: 1000 })
    }).toPass()

  // A place, by a word from its description.
  await openBar()
  await input.fill('mailbox')
  await shot(page, '21-command-bar')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/settings$/)
  await expect(bar).toBeHidden()

  // A job for a project, by its words: Claude Code opens with a ticket for exactly that.
  await openBar()
  await input.fill('posts instagram rondje')
  const before = launches().length
  await bar.getByRole('option', { name: /Maak posts voor Instagram/ }).first().click()
  await expect(bar.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()
  expect(launches()).toHaveLength(before + 1)
  const posts = await mcpTool(request, 'get_task', { ticket: lastTicket() })
  expect(posts.text).toContain('What the cockpit knows about Rondje')
  expect(posts.text).toContain('`save_posts`')
  await expect(bar).toBeHidden()

  // Anything else he types is a question for Claude: the first option, so Enter asks it.
  await openBar()
  await input.fill('Wat is mijn beste kanaal?')
  await expect(bar.getByRole('option').first()).toContainText('Wat is mijn beste kanaal?')
  await input.press('Enter')
  await expect(bar.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()
  const asked = await mcpTool(request, 'get_task', { ticket: lastTicket() })
  expect(asked.text).toContain('Wat is mijn beste kanaal?')
  await context.close()
})
