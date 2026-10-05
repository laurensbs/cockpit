import { generateKeyPairSync } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { newVisitor, shot, TOKEN } from './helpers'

// Linking by itself: he pastes one Plausible key and one Vercel token (the Google account is already
// there), and the cockpit finds per project the Vercel project, the real domain, and on the site
// Plausible, Google Analytics, Search Console and Discord, links them and pulls their numbers. Teampje
// had nothing filled in. What was already set stays; a failing deploy becomes a quest.
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const EMAIL = 'cockpit-e2e@cockpit-test.iam.gserviceaccount.com'
const keyFile = JSON.stringify({ type: 'service_account', project_id: 'cockpit-test', client_email: EMAIL, private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), token_uri: 'https://oauth2.googleapis.com/token' })

test('linking by itself: Vercel, the site, Plausible, GA4, Search Console and Discord', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/settings#sources')
  const sources = page.locator('#sources')

  // The Google account (12-sources took it away again at its end).
  const google = sources.getByRole('form', { name: 'Google-service-account' })
  await google.getByLabel('Sleutelbestand (JSON)').fill(keyFile)
  await google.getByRole('button', { name: 'Bewaren' }).click()
  await expect(google.getByRole('status')).toContainText(`Bewaard: ${EMAIL}`)

  const plausible = sources.getByRole('form', { name: 'Plausible-sleutel' })
  await plausible.getByLabel('Plausible-sleutel').fill('plausible-fixture-key-123456')
  await plausible.getByRole('button', { name: 'Bewaren' }).click()
  await expect(plausible.getByRole('status')).toContainText('Bewaard.')

  const vercel = sources.getByRole('form', { name: 'Vercel-token' })
  await vercel.getByLabel('Vercel-token').fill('geen token')
  await vercel.getByRole('button', { name: 'Bewaren' }).click()
  await expect(vercel.getByRole('alert')).toContainText('Dat lijkt geen Vercel-token')
  await vercel.getByLabel('Vercel-token').fill('vercel-fixture-token-1234567890')
  await vercel.getByRole('button', { name: 'Bewaren' }).click()
  await expect(vercel.getByRole('status')).toContainText(/Bewaard\. \d+ koppelingen gelegd\./)
  await page.reload()
  await expect(sources.getByText('Vercel').first()).toBeVisible()
  const html = await page.content()
  for (const secret of ['vercel-fixture-token-1234567890', 'plausible-fixture-key-123456']) expect(html).not.toContain(secret)

  // Teampje: nothing typed in, everything found and linked.
  await page.goto('/projects')
  await page.getByRole('link', { name: /Teampje/ }).first().click()
  const found = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Gevonden' }) })
  const row = (kind: string) => found.locator(`li[data-kind="${kind}"]`)
  await expect(row('site')).toContainText('https://teampje.example · via Vercel')
  await expect(row('vercel')).toContainText('teampje')
  await expect(row('plausible')).toContainText('teampje.example · op je site')
  await expect(row('ga4')).toContainText('777777 · via Google')
  await expect(row('gsc')).toContainText('sc-domain:teampje.example · via Google')
  await expect(row('discord')).toContainText('discord.gg/teampje · op je site')
  await expect(found.getByText('Deploy werkt')).toBeVisible()
  await expect(found.getByText('Nog één keer jij')).toBeVisible()
  await expect(row('stripe')).toContainText('rk_')
  await shot(page, '35-found')

  // The numbers came in the same go.
  await page.getByRole('link', { name: 'Cijfers' }).click()
  const weeks = page.locator('section[aria-labelledby="weeks-title"]')
  for (const label of ['Bezoekers', 'Discord-leden', 'Kliks uit Google']) await expect(weeks.getByRole('rowheader', { name: new RegExp(label) })).toBeVisible()

  // Undone stays undone, also when it looks again.
  await row('discord').getByRole('button', { name: 'Ongedaan maken' }).click()
  await expect(row('discord')).toHaveCount(0)
  await found.getByRole('button', { name: 'Zoek opnieuw' }).click()
  await expect(found.getByRole('status')).toHaveText('Niets nieuws gevonden.')
  await page.reload()
  await expect(row('discord')).toHaveCount(0)

  // Rondje keeps the address it had; its failing deploy is a quest.
  await page.goto('/projects')
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await expect(row('site')).toContainText('https://rondje-five.vercel.app · al ingesteld')
  await expect(found.getByText('Laatste deploy faalt')).toBeVisible()
  await page.goto('/quests')
  await expect(page.getByText('De laatste deploy van Rondje faalt')).toBeVisible()

  // The daily round looks too (and skips what it just looked at).
  const daily = await request.post('/api/daily', { headers: { Authorization: `Bearer ${TOKEN}` } })
  expect((await daily.json()).discovered).toEqual({ projects: 0, linked: 0 })
  await context.close()
})
