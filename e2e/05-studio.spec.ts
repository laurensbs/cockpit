import { expect, test } from '@playwright/test'
import { emailsFixture, ideasFixture, opportunitiesFixture, postsFixture } from '../src/lib/ai/fixtures'
import { mcpTool, newVisitor, shot } from './helpers'

// Runs after 03-projects and 04-brain: Rondje exists. The test plays Claude Code's part over MCP.
test('the studio shows what Claude Code made: mails, posts, ideas, opportunities and a personal mail', async ({ browser, request }) => {
  for (const [tool, args] of [
    ['save_emails', { project: 'Rondje', purpose: 'outreach', language: 'nl', drafts: emailsFixture().drafts }],
    ['save_posts', { project: 'Rondje', platform: 'instagram', language: 'nl', posts: postsFixture().posts }],
    ['save_ideas', { project: 'Rondje', mode: 'surprise', ideas: ideasFixture().ideas }],
    ['save_opportunities', { project: 'Rondje', language: 'nl', opportunities: opportunitiesFixture().opportunities }],
  ] as const) {
    const saved = await mcpTool(request, tool, args as Record<string, unknown>)
    expect(saved.isError, tool).toBe(false)
    expect(saved.text, tool).toContain('Opgeslagen')
  }

  const { context, page } = await newVisitor(browser)
  await page.goto('/studio')
  await page.getByRole('navigation', { name: 'Project' }).getByRole('link', { name: 'Rondje' }).click()
  await expect(page.getByText('Alles voor de groei van Rondje')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Organische groei: wat nu?' })).toBeVisible()
  await page.getByRole('link', { name: 'Concepten' }).click()

  // A generator button opens Claude Code with the choices made here.
  await page.getByRole('button', { name: /Schrijf mails/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Claude werkt eraan' })).toBeVisible()

  // Mails: drafts with a mailto link; "Verstuurd" (sent from his own mail app) gives XP.
  const mail = page.locator('article').filter({ hasText: 'Meer wandelingen voor jullie honden, gratis' })
  await expect(mail.getByRole('link', { name: 'Open in mail' })).toHaveAttribute('href', /^mailto:\?subject=Meer%20wandelingen/)
  await expect(mail).toContainText('Liever geen mail meer hierover?')
  await mail.getByRole('button', { name: 'Verstuurd' }).click()
  await expect(page.locator('.toast')).toContainText('+10 XP')

  // Posts: plan one for tomorrow, see it in the calendar, mark it posted.
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
  await expect(page.getByText('Ruil een rondje tegen koffie')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Ideeën op impact en moeite' })).toBeVisible()
  const idea = page.locator('article').filter({ hasText: 'Ruil een rondje tegen koffie' })
  await idea.getByRole('button', { name: 'Maak quest' }).click()
  await expect(idea.getByText('quest', { exact: true })).toBeVisible()
  await idea.getByRole('button', { name: 'Goed idee' }).click()
  await expect(idea.getByRole('button', { name: 'Goed idee' })).toHaveAttribute('aria-pressed', 'true')

  // Opportunities from the web: only real web links are clickable; one goes to the contacts.
  await page.getByRole('link', { name: 'Kansen' }).click()
  await expect(page.getByText('Dierenopvang Voorbeeld')).toBeVisible()
  await expect(page.getByRole('link', { name: 'example.org' })).toHaveAttribute('href', 'https://example.org/opvang')
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)
  const chance = page.locator('article').filter({ hasText: 'Dierenopvang Voorbeeld' })
  await chance.getByRole('button', { name: 'Naar contacten' }).click()
  await expect(chance.getByText('bij contacten')).toBeVisible()

  // Contacts: Claude sees the organisation and the notes, never the address; the mail lands on the card.
  await page.goto('/projects')
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await page.getByRole('link', { name: 'Contacten' }).click()
  await expect(page.getByText('Dierenopvang Voorbeeld')).toBeVisible()
  const form = page.locator('form').filter({ has: page.getByLabel('Organisatie') })
  await form.getByLabel('Organisatie').fill('Stichting Testopvang')
  await form.getByLabel('Zakelijk e-mailadres').fill('info@testopvang.nl')
  await form.getByRole('button', { name: 'Contact toevoegen' }).click()
  const card = page.locator('li.card').filter({ hasText: 'Stichting Testopvang' })
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: /Schrijf een persoonlijke mail/ }).click()
  await expect(card.getByRole('status').filter({ hasText: 'Claude werkt eraan' })).toBeVisible()

  const listed = await mcpTool(request, 'list_contacts', { project: 'Rondje' })
  expect(listed.text).not.toContain('info@testopvang.nl')
  const contact = (JSON.parse(listed.text) as { id: string; organization: string }[]).find((c) => c.organization === 'Stichting Testopvang')!
  expect(contact).toBeTruthy()
  const personal = await mcpTool(request, 'save_emails', { project: 'Rondje', purpose: 'contact', contactId: contact.id, language: 'nl', drafts: emailsFixture().drafts.slice(0, 1) })
  expect(personal.text).toContain('Stichting Testopvang')
  await page.reload()
  await expect(card.getByText('Aan: info@testopvang.nl')).toBeVisible()
  await expect(card.getByRole('link', { name: 'Open in mail' })).toHaveAttribute('href', /^mailto:info@testopvang\.nl\?subject=/)
  await card.getByLabel('Status').selectOption('replied')
  await expect(page.locator('.toast')).toContainText('+40 XP')
  await shot(page, '10-contacts')
  await context.close()
})
