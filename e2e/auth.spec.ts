import { expect, test } from '@playwright/test'
import { newVisitor, OWNER, signInOwner } from './helpers'

test('only the owner, with the setup code, can claim the cockpit', async ({ browser }) => {
  // A stranger is sent to the login page and cannot make an account, not even with the owner's address.
  const stranger = await newVisitor(browser)
  await stranger.page.goto('/settings')
  await expect(stranger.page).toHaveURL(/\/login/)
  await stranger.page.getByRole('button', { name: 'Eerste keer' }).click()
  await stranger.page.getByLabel('Voornaam').fill('Mallory')
  await stranger.page.getByLabel('E-mailadres').fill('mallory@example.org')
  await stranger.page.getByLabel('Wachtwoord').fill('mallory-12345')
  await stranger.page.getByLabel('Setup-code').fill(OWNER.code)
  await stranger.page.getByRole('button', { name: 'Cockpit claimen' }).click()
  await expect(stranger.page.locator('.notice[role=alert]')).toContainText('geen toegang')
  await stranger.page.getByLabel('E-mailadres').fill(OWNER.email)
  await stranger.page.getByLabel('Setup-code').fill('a-guess')
  await stranger.page.getByRole('button', { name: 'Cockpit claimen' }).click()
  await expect(stranger.page.locator('.notice[role=alert]')).toContainText('setup-code klopt niet')
  await stranger.context.close()

  // The owner claims it, and after signing out can sign in again.
  const owner = await newVisitor(browser)
  await signInOwner(owner.page)
  await owner.page.getByRole('button', { name: 'Uitloggen' }).click()
  await owner.page.waitForURL(/\/login/)
  await signInOwner(owner.page)
  await owner.context.close()
})

test('health tells what is connected without leaking keys', async ({ request }) => {
  const health = await (await request.get('/api/health')).json()
  expect(health).toMatchObject({ ok: true, database: 'pglite', ai: 'fixtures', github: 'fixtures' })
  expect(JSON.stringify(health)).not.toMatch(/sk-|ghp_|github_pat_/)
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toMatch(/Disallow: \//)
})
