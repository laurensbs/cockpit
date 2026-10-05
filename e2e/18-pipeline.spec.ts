import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { addDays, dayOf } from '../src/lib/dates'
import { mcpTool, newVisitor, shot, TOKEN } from './helpers'

// The pipeline board: every contact that answered, by stage, with what it is worth and the next step.
// He moves deals with buttons, a late next step becomes a quest, Claude writes the mail for the next
// step, and for a project without Stripe or Mollie won deals can count as revenue.
const launches = () =>
  readFileSync('test-results/claude-launch.txt', 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { command: string })
const lastTicket = () => launches().at(-1)!.command.match(/ticket ([a-f0-9]{8})/)![1]

async function openContacts(page: Page, project: string) {
  await page.goto('/projects')
  await page.getByRole('link', { name: new RegExp(project) }).first().click()
  await page.getByRole('link', { name: 'Contacten' }).click()
}

async function addAnswered(page: Page, organization: string) {
  const add = page.locator('form').filter({ has: page.getByLabel('Organisatie') })
  await add.getByLabel('Organisatie').fill(organization)
  await add.getByRole('button', { name: 'Contact toevoegen' }).click()
  const card = page.locator('li.card').filter({ hasText: organization })
  await card.getByLabel('Status').selectOption('replied')
  await expect(page.locator('#board').getByRole('article', { name: organization })).toBeVisible()
  return card
}

test('the pipeline board: stages, value, the next step as a quest, and won deals as revenue', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  const today = dayOf(new Date())
  await openContacts(page, 'Webstability')
  const board = page.locator('#board')
  const column = (name: string) => board.getByRole('listitem', { name })

  // The deal won earlier is on the board; Webstability's revenue comes from Stripe, so won deals never count as revenue.
  await expect(column('Gewonnen').getByRole('article', { name: 'Bakkerij Jansen' })).toContainText('€ 149 per maand')
  await expect(board.getByRole('checkbox', { name: /Gewonnen telt als omzet/ })).toBeDisabled()

  // A new answer: a lead, with what it is worth and a next step that is already late.
  const card = await addAnswered(page, 'Studio Noord')
  await card.getByText('Deal').click()
  await card.getByLabel('Waarde (€)').fill('2.400')
  await card.getByLabel('Per').selectOption('once')
  await card.getByLabel('Volgende stap').fill('Offerte bespreken')
  await card.getByLabel('Wanneer').fill(addDays(today, -1))
  await card.getByRole('button', { name: 'Bewaren' }).click()
  await expect(card.getByRole('status').filter({ hasText: 'Bewaard.' })).toBeVisible()
  const deal = board.getByRole('article', { name: 'Studio Noord' })
  await expect(deal).toContainText('€ 2.400 eenmalig')
  await expect(deal).toContainText('Offerte bespreken')
  await expect(deal).toContainText('te laat')
  await expect(board.getByText('1 volgende stap vandaag of te laat')).toBeVisible()

  // One step on at a time, with buttons; the status in the list below follows.
  await deal.getByRole('button', { name: 'Gesprek gepland' }).click()
  await expect(column('Gesprek').getByRole('article', { name: 'Studio Noord' })).toBeVisible()
  await column('Gesprek').getByRole('article', { name: 'Studio Noord' }).getByRole('button', { name: 'Offerte gestuurd' }).click()
  await expect(column('Offerte').getByRole('article', { name: 'Studio Noord' })).toBeVisible()
  await expect(card.getByLabel('Status')).toHaveValue('offer')
  await expect(column('Offerte')).toContainText('€ 2.400 eenmalig')
  await shot(page, '33-pipeline')

  // Lost, and opened again as a lead.
  await column('Offerte').getByRole('article', { name: 'Studio Noord' }).getByRole('button', { name: 'Verloren' }).click()
  await column('Verloren').getByRole('article', { name: 'Studio Noord' }).getByRole('button', { name: 'Heropen' }).click()
  await expect(column('Lead').getByRole('article', { name: 'Studio Noord' })).toBeVisible()

  // The late next step is a quest after the daily round.
  const daily = await request.post('/api/daily', { headers: { Authorization: `Bearer ${TOKEN}` } })
  expect(daily.ok()).toBe(true)
  await page.goto('/quests')
  await expect(page.getByText('Offerte bespreken: Studio Noord')).toBeVisible()

  // Claude writes one mail for the next step, not a cold sequence.
  await openContacts(page, 'Webstability')
  await board.getByRole('article', { name: 'Studio Noord' }).getByRole('button', { name: 'Mail voor de volgende stap' }).click()
  await expect(board.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()
  const brief = await mcpTool(request, 'get_task', { ticket: lastTicket() })
  expect(brief.text).toContain('Task: one short email that moves this deal to its next step')
  expect(brief.text).toContain('Worth: €2400 once')
  expect(brief.text).toContain('His next step: Offerte bespreken')
  const pipeline = await mcpTool(request, 'list_pipeline', { project: 'Webstability' })
  expect(pipeline.text).toContain('"organization": "Studio Noord"')
  expect(pipeline.text).toContain('"due": "late"')
  expect(pipeline.text).not.toContain('@')

  // Rondje has no payment source: a won deal can count as revenue, and goes again when it moves back.
  await openContacts(page, 'Rondje')
  await addAnswered(page, 'Hondenschool Vrij')
  const school = page.locator('li.card').filter({ hasText: 'Hondenschool Vrij' })
  await school.getByText('Deal').click()
  await school.getByLabel('Waarde (€)').fill('25')
  await school.getByRole('button', { name: 'Bewaren' }).click()
  await expect(school.getByRole('status').filter({ hasText: 'Bewaard.' })).toBeVisible()
  for (const step of ['Gesprek gepland', 'Offerte gestuurd', 'Gewonnen!']) {
    await board.getByRole('article', { name: 'Hondenschool Vrij' }).getByRole('button', { name: step }).click()
    await page.waitForLoadState('networkidle')
  }
  await expect(column('Gewonnen').getByRole('article', { name: 'Hondenschool Vrij' })).toBeVisible()
  await board.getByRole('checkbox', { name: /Gewonnen telt als omzet/ }).check()
  await expect.poll(async () => (await mcpTool(request, 'get_numbers', { project: 'Rondje', key: 'mrr', weeks: 2 })).text).toContain('"value": 25')
  const customers = await mcpTool(request, 'get_numbers', { project: 'Rondje', key: 'customers', weeks: 2 })
  expect(customers.text).toContain('"pipeline"')
  await column('Gewonnen').getByRole('article', { name: 'Hondenschool Vrij' }).getByRole('button', { name: /Terug naar Offerte/ }).click()
  await expect.poll(async () => (await mcpTool(request, 'get_numbers', { project: 'Rondje', key: 'mrr', weeks: 2 })).text).toContain('"value": 0')
  await page.reload()
  await board.getByRole('checkbox', { name: /Gewonnen telt als omzet/ }).uncheck()
  await expect.poll(async () => (await mcpTool(request, 'get_numbers', { project: 'Rondje', key: 'mrr', weeks: 2 })).text).toContain('No numbers for Rondje (mrr) yet')
  await context.close()
})
