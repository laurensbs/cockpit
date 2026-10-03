import { expect, test } from '@playwright/test'
import { newVisitor, shot, signInOwner } from './helpers'

// Runs after 03-projects and 04-brain: Rondje exists. AI_FIXTURES=1, so nothing is spent or sent.
test('the studio drafts mails and posts, thinks up ideas and finds opportunities', async ({ browser }) => {
  const { context, page } = await newVisitor(browser)
  await signInOwner(page)
  await page.goto('/studio')
  await page.getByRole('navigation', { name: 'Project' }).getByRole('link', { name: 'Rondje' }).click()
  await expect(page.getByText('Concepten van Claude voor Rondje.')).toBeVisible()

  // Mails: drafts with a mailto link; "Verstuurd" (sent from his own mail app) gives XP.
  await page.getByRole('button', { name: /Schrijf mails/ }).click()
  await expect(page.getByText('Meer wandelingen voor jullie honden, gratis')).toBeVisible({ timeout: 30_000 })
  const mail = page.locator('article').filter({ hasText: 'Meer wandelingen voor jullie honden, gratis' })
  await expect(mail.getByRole('link', { name: 'Open in mail' })).toHaveAttribute('href', /^mailto:\?subject=Meer%20wandelingen/)
  await expect(mail).toContainText('Liever geen mail meer hierover?')
  await mail.getByRole('button', { name: 'Verstuurd' }).click()
  await expect(page.locator('.toast')).toContainText('+10 XP')

  // Posts: plan one for tomorrow, see it in the calendar, mark it posted.
  await page.getByRole('button', { name: /Maak 5 posts/ }).click()
  await expect(page.getByText('Dit is Bram. Hij wacht op jou.')).toBeVisible({ timeout: 30_000 })
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(Date.now() + 86_400_000))
  const post = page.locator('article').filter({ hasText: 'Dit is Bram. Hij wacht op jou.' })
  await post.getByLabel('Datum om te posten').fill(tomorrow)
  await shot(page, '09-studio')
  await page.getByRole('link', { name: 'Kalender' }).click()
  const planned = page.locator('.calendar article').filter({ hasText: 'Dit is Bram. Hij wacht op jou.' })
  await expect(planned).toBeVisible()
  await planned.getByRole('button', { name: 'Gepost' }).click()
  await expect(page.locator('.toast')).toContainText('+15 XP')

  // Idea lab: ideas on an impact/effort matrix; one becomes a quest, one gets a thumbs up.
  await page.getByRole('link', { name: 'Idee-lab' }).click()
  await page.getByRole('button', { name: /Bedenk 6 ideeën/ }).click()
  await expect(page.getByText('Ruil een rondje tegen koffie')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('img', { name: 'Ideeën op impact en moeite' })).toBeVisible()
  const idea = page.locator('article').filter({ hasText: 'Ruil een rondje tegen koffie' })
  await idea.getByRole('button', { name: 'Maak quest' }).click()
  await expect(idea.getByText('quest', { exact: true })).toBeVisible()
  await idea.getByRole('button', { name: 'Goed idee' }).click()
  await expect(idea.getByRole('button', { name: 'Goed idee' })).toHaveAttribute('aria-pressed', 'true')

  // Opportunities from the web: only real web links are clickable; one goes to the contacts.
  await page.getByRole('link', { name: 'Kansen' }).click()
  await page.getByRole('button', { name: /Zoek kansen op het web/ }).click()
  await expect(page.getByText('Dierenopvang Voorbeeld')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'example.org' })).toHaveAttribute('href', 'https://example.org/opvang')
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)
  const chance = page.locator('article').filter({ hasText: 'Dierenopvang Voorbeeld' })
  await chance.getByRole('button', { name: 'Naar contacten' }).click()
  await expect(chance.getByText('bij contacten')).toBeVisible()

  // Contacts: a personal mail to a business address, and an answer is worth the most XP.
  await page.goto('/projects')
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await page.getByRole('link', { name: 'Contacten' }).click()
  await expect(page.getByText('Dierenopvang Voorbeeld')).toBeVisible()
  const form = page.locator('form').filter({ has: page.getByLabel('Organisatie') })
  await form.getByLabel('Organisatie').fill('Stichting Testopvang')
  await form.getByLabel('Zakelijk e-mailadres').fill('info@testopvang.nl')
  await form.getByRole('button', { name: 'Contact toevoegen' }).click()
  await expect(page.getByText('Contact toevoegen').first()).toBeVisible()
  const card = page.locator('li.card').filter({ hasText: 'Stichting Testopvang' })
  await card.getByRole('button', { name: /Schrijf een persoonlijke mail/ }).click()
  await expect(card.getByText('Aan: info@testopvang.nl')).toBeVisible({ timeout: 30_000 })
  await expect(card.getByRole('link', { name: 'Open in mail' })).toHaveAttribute('href', /^mailto:info@testopvang\.nl\?subject=/)
  await card.getByLabel('Status').selectOption('replied')
  await expect(page.locator('.toast')).toContainText('+40 XP')
  await shot(page, '10-contacts')
  await context.close()
})
