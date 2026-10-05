import { expect, test } from '@playwright/test'
import { newVisitor, shot } from './helpers'

test('quests give XP, a boss levels you up, recurring quests come back', async ({ browser }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/quests')
  await expect(page.getByText(/Level 1 · 0 XP/)).toBeVisible()

  // A quest of his own, done: XP and a streak.
  const form = page.locator('#nieuw')
  await form.getByLabel('Taak', { exact: true }).fill('Btw-aangifte Q3 Webstability')
  await form.getByLabel('Wanneer').fill(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date()))
  await form.getByLabel('Herhalen').selectOption('quarterly')
  await form.getByRole('button', { name: 'Taak toevoegen' }).click()
  await expect(page.getByText('Staat op je lijst.')).toBeVisible()
  await page.getByRole('button', { name: 'Rond af: Btw-aangifte Q3 Webstability' }).click()
  // The first quest also unlocks a badge: a moment, not just a toast.
  await expect(page.getByRole('dialog', { name: 'Gefeliciteerd' })).toContainText('Eerste quest')
  await page.getByRole('dialog', { name: 'Gefeliciteerd' }).click()
  await page.reload()
  // It comes back next quarter, still open.
  await expect(page.getByRole('button', { name: 'Rond af: Btw-aangifte Q3 Webstability' })).toBeVisible()
  await expect(page.getByText('+25', { exact: true }).first()).toBeVisible()

  // A boss is worth 250 XP: with the first 25 that is level 2 (level 3 needs 300).
  await form.getByLabel('Taak', { exact: true }).fill('Lanceer de RSPS-site')
  await form.getByText('Hoofdtaak van de week').click()
  await form.getByRole('button', { name: 'Taak toevoegen' }).click()
  await expect(page.getByText('Staat op je lijst.')).toBeVisible()
  await page.getByRole('button', { name: 'Rond af: Lanceer de RSPS-site' }).click()
  const party = page.getByRole('dialog', { name: 'Gefeliciteerd' })
  await expect(party).toContainText('Level up')
  await expect(party).toContainText('Knutselaar')
  await expect(party).toContainText('Baas verslagen')
  await shot(page, '06-level-up')
  await party.click()

  // Today shows the streak; the level and the XP stay on Taken.
  await page.goto('/')
  await expect(page.getByText('1 dag op rij')).toBeVisible()
  await shot(page, '07-today')
  await page.goto('/quests')
  await expect(page.getByText(/Level 2 · 275 XP/)).toBeVisible()

  // Reopening takes the XP back out.
  await page.goto('/quests')
  const done = page.locator('.quest').filter({ hasText: 'Lanceer de RSPS-site' })
  await done.getByRole('button', { name: 'Meer' }).click()
  await done.getByRole('menuitem', { name: 'Terugzetten' }).click()
  await expect(page.getByText(/Level 1 · 25 XP/)).toBeVisible()
  await context.close()
})
