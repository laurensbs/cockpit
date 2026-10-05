import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { addDays, dayOf, weekStart } from '../src/lib/dates'
import { mcpTool, newVisitor, shot, TOKEN, openMore } from './helpers'

// Webstability on the meter: numbers come in by themselves (Plausible and Stripe answer from fixtures),
// Claude proposes a growth model through MCP, he accepts it, and the funnel's leak decides the next step.
const launches = () =>
  readFileSync('test-results/claude-launch.txt', 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { command: string })
const lastTicket = () => launches().at(-1)!.command.match(/ticket ([a-f0-9]{8})/)![1]

test('Webstability: sources, a growth model from Claude, the pipeline, and the leak as the next step', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  await page.getByRole('link', { name: 'Cijfers' }).click()
  await expect(page.getByRole('heading', { name: 'Bronnen' })).toBeVisible()

  // Plausible (visitors, and the contact form as leads) and Stripe, with a read-only key.
  await page.getByText('Bron koppelen').click()
  const form = page.locator('form').filter({ has: page.getByLabel('Bron') })
  await form.getByLabel('Site').fill('webstability.nl')
  await form.getByLabel('Doel dat een lead is (optioneel)').fill('Contact')
  await form.getByLabel('API-sleutel').fill('plausible-e2e-key-1234567890')
  await form.getByRole('button', { name: 'Koppelen' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Plausible gekoppeld' })).toBeVisible()
  await form.getByLabel('Bron').selectOption('stripe')
  const stripe = page.locator('form').filter({ has: page.getByLabel('Beperkte sleutel (rk_…)') })
  await stripe.getByLabel('Beperkte sleutel (rk_…)').fill('sk_live_abc123')
  await stripe.getByRole('button', { name: 'Koppelen' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'geheime sleutel' })).toBeVisible()
  await stripe.getByLabel('Beperkte sleutel (rk_…)').fill('rk_test_e2e')
  await stripe.getByRole('button', { name: 'Koppelen' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Stripe gekoppeld' })).toBeVisible()

  await page.getByRole('button', { name: 'Nu ophalen' }).click()
  await expect(page.getByRole('status').filter({ hasText: /2 bronnen opgehaald, \d+ cijfers/ })).toBeVisible()
  await page.reload()
  const weeks = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Per week' }) })
  for (const row of ['Bezoekers', 'Aanvragen', 'Omzet (€)', 'Vaste omzet per maand (€)', 'Klanten']) await expect(weeks.getByRole('rowheader', { name: new RegExp(row.replace(/[()€]/g, '.')) })).toBeVisible()
  await expect(weeks.getByText('Plausible').first()).toBeVisible()
  // The keys never leave the computer, not even into the page.
  const html = await page.content()
  expect(html).not.toContain('rk_test_e2e')
  expect(html).not.toContain('plausible-e2e-key')

  // Pulling again gives the same numbers: a day is replaced, never counted twice.
  const before = await weeks.locator('table').innerText()
  await page.getByRole('button', { name: 'Nu ophalen' }).click()
  await expect(page.getByRole('status').filter({ hasText: /2 bronnen opgehaald/ })).toBeVisible()
  await page.reload()
  expect(await weeks.locator('table').innerText()).toBe(before)

  // Claude records numbers he was told (meetings and won deals from his own notes), never a future day.
  const today = dayOf(new Date())
  const mondays = Array.from({ length: 8 }, (_, i) => addDays(weekStart(today), -7 * (8 - i)))
  const told = await mcpTool(request, 'save_metrics', {
    project: 'Webstability',
    points: [...mondays.map((day) => ({ key: 'meetings', value: 1, day, note: 'hij vertelde het' })), { key: 'deals_won', value: 1, day: mondays[3], note: 'hij vertelde het' }, { key: 'deals_won', value: 1, day: mondays[6], note: 'hij vertelde het' }],
  })
  expect(told.isError).toBe(false)
  expect(told.text).toContain('10 cijfers opgeslagen')
  const future = await mcpTool(request, 'save_metrics', { project: 'Webstability', points: [{ key: 'leads', value: 3, day: addDays(today, 3), note: 'gok' }] })
  expect(future.isError).toBe(true)
  expect(future.text).toContain('toekomst')

  // The brief for a growth model knows the numbers; Claude's proposal only counts once he accepts it.
  const brief = await mcpTool(request, 'get_task', { task: 'model', project: 'Webstability' })
  expect(brief.text).toContain('Task: a growth model for Webstability')
  expect(brief.text).toMatch(/- visitors \(plausible\): \d/)
  expect(brief.text).toContain('`save_model`')
  const tooFar = await mcpTool(request, 'save_model', { project: 'Webstability', model: { northStar: { key: 'mrr', target: 3000, deadline: addDays(today, 500) }, funnel: [{ key: 'visitors' }, { key: 'leads', rate: 0.02 }] } })
  expect(tooFar.isError).toBe(true)
  const proposed = await mcpTool(request, 'save_model', {
    project: 'Webstability',
    model: {
      northStar: { key: 'mrr', target: 3000, deadline: addDays(today, 120) },
      funnel: [
        { key: 'visitors', label: 'Bezoekers' },
        { key: 'leads', label: 'Aanvragen', rate: 0.02 },
        { key: 'meetings', label: 'Gesprekken', rate: 0.4 },
        { key: 'deals_won', label: 'Klanten', rate: 0.3 },
      ],
      valuePerDeal: 149,
      note: 'Aanname: 2% van de bezoekers vraagt iets aan.',
    },
  })
  expect(proposed.isError).toBe(false)
  await page.reload()
  await expect(page.getByText('Voorstel van Claude')).toBeVisible()
  await page.getByRole('button', { name: 'Dit doel overnemen' }).click()
  await expect(page.getByRole('heading', { name: 'Doel: Vaste omzet per maand' })).toBeVisible()
  await expect(page.locator('.growth-card')).toContainText(/van €\s3\.000/)
  await expect(page.locator('.funnel')).toBeVisible()
  // Plausible's leads are a third of what the model expects: that is where it leaks.
  await expect(page.getByText(/Hier lekt het: bezoekers → aanvragen/)).toBeVisible()
  await shot(page, '22-numbers')

  // The pipeline: a reply keeps its XP through meeting, offer and a won deal, which is worth more.
  const xpOf = async () => JSON.parse((await mcpTool(request, 'get_stats')).text).totalXp as number
  const startXp = await xpOf()
  await page.getByRole('link', { name: 'Contacten' }).click()
  const add = page.locator('form').filter({ has: page.getByLabel('Organisatie') })
  await add.getByLabel('Organisatie').fill('Bakkerij Jansen')
  await add.getByLabel('Zakelijk e-mailadres').fill('info@bakkerij-jansen.test')
  await add.getByRole('button', { name: 'Contact toevoegen' }).click()
  const card = page.locator('li').filter({ hasText: 'Bakkerij Jansen' })
  for (const status of ['replied', 'meeting', 'offer', 'won']) {
    await card.getByLabel('Status').selectOption(status)
    await page.waitForLoadState('networkidle')
  }
  await expect.poll(xpOf).toBe(startXp + 40 + 75)
  await card.getByText('Deal').click()
  await card.getByLabel('Waarde (€)').fill('149')
  await card.getByLabel('Volgende stap').fill('Onboarding plannen')
  await card.getByRole('button', { name: 'Deal bijwerken' }).click()
  await expect(card.getByRole('status').filter({ hasText: 'Bewaard.' })).toBeVisible()

  // Vandaag: the leak decides the step, and the chip opens Claude Code with experiments aimed at it.
  await page.goto('/')
  await openMore(page)
  const next = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Nu doen' }) })
  const row = next.locator('li').filter({ hasText: 'Meer bezoekers omzetten in leads' })
  await expect(row).toContainText('Daar lekt de trechter het meest')
  await row.getByRole('button', { name: /Webstability/ }).click()
  await expect(next.getByRole('status').filter({ hasText: 'Claude werkt eraan' })).toBeVisible()
  const experiments = await mcpTool(request, 'get_task', { ticket: lastTicket() })
  expect(experiments.text).toContain('Focus: every experiment aims to move Aanvragen')
  expect(experiments.text).toContain('<growth>')
  expect(experiments.text).toMatch(/Bottleneck: visitors → leads converts/)
  await shot(page, '23-today-outcome')

  // The daily round pulls by itself too (and skips sources that just ran).
  const daily = await request.post('/api/daily', { headers: { Authorization: `Bearer ${TOKEN}` } })
  expect(daily.ok()).toBe(true)
  expect((await daily.json()).numbers).toEqual({ pulled: 0, failed: 0 })
  await context.close()
})
