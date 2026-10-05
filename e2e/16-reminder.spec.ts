import { expect, test } from '@playwright/test'
import { newVisitor, TOKEN } from './helpers'

// The daily nudge: he picks a time (or switches it off); the app asks every minute and gets at most one
// "show" a day. The rule itself (working days, after his time, day goal open) is in the unit tests.

test('the daily reminder: set in Settings, asked by the app, never twice a day', async ({ browser, request }) => {
  expect((await request.post('/api/reminder')).status()).toBe(401)
  const ask = async () => (await (await request.post('/api/reminder', { headers: { Authorization: `Bearer ${TOKEN}` } })).json()) as { show: boolean; title?: string; body?: string }

  const { context, page } = await newVisitor(browser)
  await page.goto('/settings')
  const reminder = page.getByLabel('Dagelijkse herinnering')
  await expect(reminder.getByRole('checkbox', { name: /Dagelijkse herinnering/ })).toBeChecked()
  await reminder.getByLabel('Tijd van de herinnering').fill('00:01')
  await reminder.getByLabel('Tijd van de herinnering').blur()
  await expect(reminder.getByRole('status')).toContainText('Elke werkdag om 00:01 een seintje')

  // Whatever the first answer is (a weekend, or the day goal already reached), the second is never a yes.
  const first = await ask()
  if (first.show) expect(first.title).toBe('Je dag staat klaar')
  expect((await ask()).show).toBe(false)

  // Switched off: quiet.
  await reminder.getByRole('checkbox', { name: /Dagelijkse herinnering/ }).uncheck()
  await expect(reminder.getByRole('status')).toContainText('Geen herinnering meer')
  expect((await ask()).show).toBe(false)
  await context.close()
})
