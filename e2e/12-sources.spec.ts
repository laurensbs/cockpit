import { generateKeyPairSync } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { mcpTool, newVisitor, shot } from './helpers'

// Every project measured: a Google service account once in Settings, then Rondje's Discord, its own
// stats address, Google Analytics and Search Console on Cijfers. Google, Discord and the app answer
// from fixtures; the key pair is made here, so no real key exists anywhere.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const EMAIL = 'cockpit-e2e@cockpit-test.iam.gserviceaccount.com'
const keyFile = JSON.stringify({ type: 'service_account', project_id: 'cockpit-test', client_email: EMAIL, private_key: pem, token_uri: 'https://oauth2.googleapis.com/token' })

test('Rondje: a Google account, Discord, its own app, GA4 and Search Console, and Claude reads the numbers', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await page.getByRole('link', { name: 'Cijfers' }).click()
  await page.waitForURL(/\/numbers$/)
  const numbersUrl = page.url()
  await page.getByText('Bron koppelen').click()
  const form = page.locator('form').filter({ has: page.getByLabel('Bron') })

  // Google needs the service account first; the form says where.
  await form.getByLabel('Bron').selectOption('ga4')
  await expect(form.getByText('Zet eerst het Google-service-account in Instellingen → Bronnen.')).toBeVisible()

  // Settings → Bronnen: a wrong paste is refused; the key file is kept, and only its address comes back.
  await page.goto('/settings')
  const sources = page.locator('#sources')
  await expect(sources.getByRole('heading', { name: 'Bronnen' })).toBeVisible()
  await sources.getByLabel('Sleutelbestand (JSON)').fill('{"type":"authorized_user"}')
  await sources.getByRole('button', { name: 'Bewaren' }).click()
  await expect(sources.getByRole('alert')).toContainText('geen service-account')
  await sources.getByLabel('Sleutelbestand (JSON)').fill(keyFile)
  await sources.getByRole('button', { name: 'Bewaren' }).click()
  await expect(sources.getByRole('status').filter({ hasText: `Bewaard: ${EMAIL}` })).toBeVisible()
  await page.reload()
  await expect(sources.getByText(`Gekoppeld als ${EMAIL}`)).toBeVisible()
  expect(await page.content()).not.toContain('PRIVATE KEY')

  // Discord: an invite that expired says so; a working one replaces it.
  await page.goto(numbersUrl)
  await page.getByText('Bron koppelen').click()
  await form.getByLabel('Bron').selectOption('discord')
  await form.getByLabel('Uitnodiging').fill('https://discord.gg/verlopen')
  await form.getByRole('button', { name: 'Koppelen' }).click()
  await expect(form.getByRole('status').filter({ hasText: 'Discord gekoppeld' })).toBeVisible()
  const discordRow = page.locator('li').filter({ hasText: 'Discord' }).filter({ has: page.getByRole('button', { name: 'Test' }) })
  await discordRow.getByRole('button', { name: 'Test' }).click()
  await expect(discordRow.getByRole('status')).toContainText('bestaat niet')
  await form.getByLabel('Bron').selectOption('discord')
  await form.getByLabel('Uitnodiging').fill('discord.gg/rondje')
  await form.getByRole('button', { name: 'Koppelen' }).click()
  await expect(form.getByRole('status').filter({ hasText: 'Discord gekoppeld' })).toBeVisible()

  // Its own app: only https, with a secret that goes along as a Bearer token.
  await form.getByLabel('Bron').selectOption('app')
  await form.getByLabel('Stats-adres').fill('http://stats.rondje.test/api/stats')
  await form.getByLabel('Geheim (optioneel)').fill('rondje-stats-geheim')
  await form.getByRole('button', { name: 'Koppelen' }).click()
  await expect(form.getByRole('alert')).toContainText('https://')
  await form.getByLabel('Stats-adres').fill('https://stats.rondje.test/api/stats')
  await form.getByRole('button', { name: 'Koppelen' }).click()
  await expect(form.getByRole('status').filter({ hasText: 'Eigen app gekoppeld' })).toBeVisible()
  const appRow = page.locator('li').filter({ hasText: 'Eigen app' }).filter({ has: page.getByRole('button', { name: 'Test' }) })
  await appRow.getByRole('button', { name: 'Test' }).click()
  // Numbers the cockpit does not know are named, so he can fix the app.
  await expect(appRow.getByRole('status')).toContainText('Niet herkend: walks.')

  // Google Analytics 4 (the sign-up event counts as sign-ups) and Search Console.
  await form.getByLabel('Bron').selectOption('ga4')
  await form.getByLabel('Property-ID').fill('G-123')
  await form.getByRole('button', { name: 'Koppelen' }).click()
  await expect(form.getByRole('alert')).toContainText('een nummer')
  await form.getByLabel('Property-ID').fill('412345678')
  await form.getByLabel('Sleutelgebeurtenis (optioneel)').fill('sign_up')
  await form.getByLabel('Die gebeurtenis telt als').selectOption('signups')
  await form.getByRole('button', { name: 'Koppelen' }).click()
  await expect(form.getByRole('status').filter({ hasText: 'Google Analytics 4 gekoppeld' })).toBeVisible()
  await form.getByLabel('Bron').selectOption('gsc')
  await form.getByLabel('Property').fill('sc-domain:rondje.nl')
  await form.getByRole('button', { name: 'Koppelen' }).click()
  await expect(form.getByRole('status').filter({ hasText: 'Google Search Console gekoppeld' })).toBeVisible()

  await page.getByRole('button', { name: 'Nu ophalen' }).click()
  await expect(page.getByRole('status').filter({ hasText: /4 bronnen opgehaald, \d+ cijfers\./ })).toBeVisible()
  await page.reload()
  const weeks = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Per week' }) })
  for (const row of ['Bezoekers', 'Kliks uit Google', 'Vertoningen in Google', 'Aanmeldingen', 'Gebruikers', 'Actieve gebruikers', 'Discord-leden', 'Discord online'])
    await expect(weeks.getByRole('rowheader', { name: new RegExp(`^${row}`) })).toBeVisible()
  for (const source of ['Google Analytics', 'Search Console', 'Eigen app', 'Discord']) await expect(weeks.getByText(source, { exact: true }).first()).toBeVisible()
  const html = await page.content()
  for (const secret of ['rondje-stats-geheim', 'PRIVATE KEY', 'ya29.']) expect(html).not.toContain(secret)
  await shot(page, '26-sources')

  // Claude reads the numbers per week, with their sources, and never a key.
  const members = await mcpTool(request, 'get_numbers', { project: 'Rondje', key: 'discord_members', weeks: 4 })
  expect(members.isError).toBe(false)
  const report = JSON.parse(members.text) as { weeks: string[]; metrics: { key: string; kind: string; sources: string[]; latest: { value: number } | null }[]; sources: { label: string; error: string | null }[] }
  expect(report.weeks).toHaveLength(4)
  expect(report.metrics).toEqual([expect.objectContaining({ key: 'discord_members', kind: 'level', sources: ['discord'], latest: expect.objectContaining({ value: 812 }) })])
  expect(report.sources.map((s) => s.label).sort()).toEqual(['Discord', 'Eigen app', 'Google Analytics 4', 'Google Search Console'])
  const all = await mcpTool(request, 'get_numbers', { project: 'Rondje' })
  expect(all.text).toContain('"search_clicks"')
  expect(all.text).toContain('"signups"')
  for (const secret of ['rondje-stats-geheim', 'PRIVATE KEY', 'ya29.']) expect(all.text).not.toContain(secret)
  const none = await mcpTool(request, 'get_numbers', { project: 'Rondje', key: 'costs' })
  expect(none.text).toContain('No numbers for Rondje (costs) yet')

  // Settings shows every source of every project, and pulls them all at once.
  await page.goto('/settings')
  await expect(sources.getByText(/^\d+ gekoppeld$/)).toBeVisible()
  await expect(sources.locator('li').filter({ hasText: 'Google Search Console' })).toContainText('Rondje')
  await sources.getByRole('button', { name: 'Alles nu ophalen' }).click()
  await expect(sources.getByRole('status').filter({ hasText: /bronnen opgehaald/ })).toBeVisible()
  await shot(page, '27-settings-sources')

  // Without the account, Google stops with a clear reason, and the rest keeps working.
  await sources.getByRole('button', { name: 'Verwijderen' }).click()
  await expect(sources.getByRole('status').filter({ hasText: 'Service-account verwijderd' })).toBeVisible()
  await page.goto(numbersUrl)
  const gaRow = page.locator('li').filter({ hasText: 'Google Analytics 4' }).filter({ has: page.getByRole('button', { name: 'Test' }) })
  await gaRow.getByRole('button', { name: 'Test' }).click()
  await expect(gaRow.getByRole('status')).toContainText('Zet eerst het Google-service-account')
  await discordRow.getByRole('button', { name: 'Test' }).click()
  await expect(discordRow.getByRole('status')).toContainText('Werkt:')
  await context.close()
})
