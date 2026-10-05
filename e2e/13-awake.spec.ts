import { expect, test } from '@playwright/test'
import { newVisitor, TOKEN } from './helpers'

// "Aan laten staan": the app window asks every minute whether to keep the computer awake and says what
// it does; he switches it in Settings.
test('keep the computer awake on mains power, switched in Settings', async ({ browser, request }) => {
  const ask = (status: string, token: string | null = TOKEN) =>
    request.post('/api/keep-awake', { headers: token ? { Authorization: `Bearer ${token}` } : {}, data: { status } })

  expect((await ask('awake', null)).status()).toBe(401)
  expect((await ask('awake', 'wrong-token')).status()).toBe(401)
  const first = await ask('awake')
  expect(await first.json()).toEqual({ on: true })

  const { context, page } = await newVisitor(browser)
  await page.goto('/settings')
  const card = page.locator('#awake')
  await expect(card.getByRole('heading', { name: 'Aan laten staan' })).toBeVisible()
  await expect(card.getByText('Blijft wakker', { exact: true })).toBeVisible()
  const toggle = card.getByRole('checkbox', { name: /Wakker blijven aan de stroom/ })
  await expect(toggle).toBeChecked()

  await toggle.uncheck()
  await expect.poll(async () => (await (await ask('off')).json()).on).toBe(false)
  await page.reload()
  await expect(card.getByText('Uit', { exact: true })).toBeVisible()
  await expect(toggle).not.toBeChecked()

  await toggle.check()
  await expect.poll(async () => (await (await ask('battery')).json()).on).toBe(true)
  await page.reload()
  await expect(card.getByText('Op de accu', { exact: true })).toBeVisible()
  await context.close()
})
