import { expect, test } from '@playwright/test'
import { mcpTool, newVisitor } from './helpers'

// Money: Claude writes down from his documents what he pays, his prices and the dates to watch; the money
// page adds it up and says how many customers cover it; a date near shows up in his day; his word wins.
// Fictional lines only (the repo is public).

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const nextYear = (day: string) => `${Number(day.slice(0, 4)) + 1}${day.slice(4)}`

test('Claude writes down the money, the page adds it up and reminds, and his own change stays his', async ({ browser, request }) => {
  const renewal = inDays(3)
  const saved = await mcpTool(request, 'save_money', {
    items: [
      { kind: 'cost', title: 'Hosting voorbeeld', amount: 20, currency: 'USD', period: 'month', note: 'Testregel' },
      { project: 'Webstability', kind: 'cost', title: 'Domein voorbeeld.test', amount: 12, period: 'year', nextDate: renewal, note: 'Testregel' },
      { project: 'Webstability', kind: 'price', title: 'Pakket per maand', amount: 69, period: 'month' },
      { kind: 'plan', title: 'Verzekering voorbeeld', amount: 500, period: 'year' },
      { project: 'Bestaat niet', kind: 'cost', title: 'Iets', amount: 1, period: 'month' },
    ],
  })
  expect(saved.text).toContain('4 regels over geld bewaard')
  expect(saved.text).toContain('onbekend project: Bestaat niet')

  // The coach and the money task see it.
  const brief = await mcpTool(request, 'get_task', { task: 'money' })
  expect(brief.text).toContain('put everything about money for his businesses into the cockpit')
  expect(brief.text).toContain('<money>')
  expect(brief.text).toContain('Break-even: 1 paying customer at €69 a month (Pakket per maand)')
  expect((await mcpTool(request, 'get_task', { task: 'coach' })).text).toContain('Fixed costs, about €')

  // A tax date in two days: a step in his day.
  await mcpTool(request, 'save_money', { items: [{ kind: 'deadline', title: 'Aangifte voorbeeld', period: 'quarter', nextDate: inDays(2) }] })
  const { context, page } = await newVisitor(browser)
  await page.goto('/')
  await expect(page.getByText('Aangifte voorbeeld: over 2 dagen').first()).toBeVisible()

  // The old Kosten page is part of Geld now.
  await page.goto('/kosten')
  await expect(page).toHaveURL(/\/geld$/)
  await expect(page.getByRole('heading', { name: 'Geld', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Je geld per maand' })).toContainText('1 klant')

  // Keeping the domain moves it a year on.
  const soon = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Komt eraan' }) })
  const domain = soon.getByRole('listitem', { name: 'Domein voorbeeld.test' })
  await expect(domain).toContainText('verlengt over 3 dagen')
  await domain.getByRole('button', { name: 'Houden', exact: true }).click()
  await expect(soon.getByRole('listitem', { name: 'Domein voorbeeld.test' })).toHaveCount(0)
  await expect(page.getByRole('listitem', { name: 'Domein voorbeeld.test' })).toContainText(nextYear(renewal))

  // No to the insurance: it leaves the list.
  const plans = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Wacht op jouw besluit' }) })
  await plans.getByRole('listitem', { name: 'Verzekering voorbeeld' }).getByRole('button', { name: 'Nee' }).click()
  await expect(page.getByRole('heading', { name: 'Wacht op jouw besluit' })).toHaveCount(0)

  // He corrects the hosting: from then on it is his, and Claude leaves it alone.
  const hosting = page.getByRole('listitem', { name: 'Hosting voorbeeld' })
  await hosting.getByRole('button', { name: 'Aanpassen' }).click()
  await hosting.getByLabel('Bedrag').fill('25')
  await hosting.getByRole('button', { name: 'Bewaren' }).click()
  await expect(page.getByRole('listitem', { name: 'Hosting voorbeeld' })).toContainText('$25 per maand')
  await expect(page.getByRole('listitem', { name: 'Hosting voorbeeld' })).toContainText('door jou')
  const again = await mcpTool(request, 'save_money', { items: [{ kind: 'cost', title: 'Hosting voorbeeld', amount: 20, currency: 'USD', period: 'month' }] })
  expect(again.text).toContain('1 door hem aangepast en dus niet overschreven')
  await context.close()
})
