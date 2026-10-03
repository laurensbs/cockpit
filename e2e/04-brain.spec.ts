import { expect, test } from '@playwright/test'
import { newVisitor, shot, signInOwner } from './helpers'

// Runs after 03-projects: Rondje is in the cockpit. AI_FIXTURES=1, so nothing is spent.
test('the marketing brain makes a profile and a plan, and plan actions become quests', async ({ browser }) => {
  const { context, page } = await newVisitor(browser)
  await signInOwner(page)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await page.getByRole('link', { name: 'Marketingbrein' }).click()
  await expect(page.getByRole('heading', { name: 'Marketingprofiel' })).toBeVisible()
  await expect(page.getByText('Testmodus: vaste antwoorden, kost niets.')).toBeVisible()

  // The profile: the button shows a rough cost, Claude (here the fixture) works, the page fills.
  const make = page.getByRole('button', { name: /Maak het profiel/ })
  await expect(make).toContainText('± $')
  await make.click()
  await expect(page.getByText('Rondje: het rondje dat je week beter maakt.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Eerste stap:/).first()).toBeVisible()
  await expect(page.getByText(/AI deze maand/)).toBeVisible()
  await expect(page.getByText('$0.08 / $10.00')).toBeVisible()

  // A quick win becomes a quest for this week.
  const win = page.locator('li').filter({ hasText: 'Mail drie opvangen' })
  await win.getByRole('button', { name: '+ quest' }).click()
  await expect(win.getByText('quest')).toBeVisible()

  // The plan builds on the profile; chosen actions become quests in their week.
  await page.getByRole('button', { name: /Maak het plan/ }).click()
  await expect(page.getByText('Mail vijf opvangen met de pitch')).toBeVisible({ timeout: 30_000 })
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
  await context.close()
})
