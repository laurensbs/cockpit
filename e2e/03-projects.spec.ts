import { expect, test } from '@playwright/test'
import { newVisitor, shot } from './helpers'

test('the five projects go in at once, linked to GitHub, with a company overview', async ({ browser }) => {
  const { context, page } = await newVisitor(browser)

  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: 'Zet je projecten erin' })).toBeVisible()
  await shot(page, '02-starter')
  // Everything he builds now is suggested; the RSPS and the game have no repository yet.
  await expect(page.getByRole('checkbox', { name: /OSRS RSPS/ })).toBeChecked()
  await expect(page.locator('input[name="repos-rsps"]')).toHaveValue('')
  await expect(page.locator('input[name="repos-rondje"]')).toHaveValue('laurensbs/value')
  await page.getByRole('button', { name: 'Zet 5 projecten erin' }).click()

  await expect(page.getByRole('heading', { name: 'Projecten', level: 1 })).toBeVisible()
  for (const name of ['OSRS RSPS', 'Rondje', 'Webstability', 'Game-app', 'Teampje']) {
    await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible()
  }
  await expect(page.getByText('Nog geen repo').first()).toBeVisible()
  await shot(page, '03-projects')

  // Rondje was read from GitHub: stack, activity and commits, with secrets from the README kept out.
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Rondje', level: 1 })).toBeVisible()
  await expect(page.getByText('laurensbs/value')).toBeVisible()
  await expect(page.getByText('Next.js', { exact: true })).toBeVisible()
  await expect(page.getByText(/actieve dagen in 30/)).toBeVisible()
  await expect(page.getByText(/Werk aan value/).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('secret@')
  await shot(page, '04-project')

  // The GitHub inbox groups what belongs together; adding them reads them right away.
  await page.goto('/github')
  await expect(page.getByText('Horen waarschijnlijk bij elkaar')).toBeVisible()
  await page.locator('input[name="repo"][value="laurensbs/caravanstallingspanje"]').check()
  await page.locator('input[name="repo"][value="laurensbs/caravanstallingspanje-repair"]').check()
  await page.getByRole('button', { name: "2 repo's koppelen" }).click()
  await expect(page.getByText('2 gekoppeld.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Gekoppeld' })).toBeVisible()

  // Numbers per month add up per company and in total.
  await page.goto('/companies')
  const form = page.locator('form').filter({ has: page.getByLabel('Waarde') })
  await form.getByLabel('Project').selectOption({ label: 'Webstability' })
  await form.getByLabel('Waarde').fill('1500')
  await form.getByRole('button', { name: 'Bewaren' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Bewaard.' })).toBeVisible()
  await page.reload()
  await expect(page.locator('.kpi').filter({ hasText: 'Omzet' })).toContainText('1.500')
  await shot(page, '05-companies')

  // The numbers export as a CSV for the owner, and for nobody else.
  const csv = await page.request.get('/api/export/metrics.csv')
  expect(csv.status()).toBe(200)
  expect(csv.headers()['content-type']).toContain('text/csv')
  const text = await csv.text()
  expect(text).toContain('bedrijf;project;maand;soort;waarde')
  expect(text).toMatch(/^Webstability;Webstability;\d{4}-\d{2};Omzet \(€\);1500\r?$/m)
  const { context: anonymous } = await newVisitor(browser, {}, { anonymous: true })
  expect((await anonymous.request.get('/api/export/metrics.csv')).status()).toBe(401)
  await anonymous.close()
  await context.close()
})
