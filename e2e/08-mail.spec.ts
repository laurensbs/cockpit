import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { mcpTool, newVisitor, TOKEN } from './helpers'

// Runs after 05 and 07. Mails go to test-results/smtp.jsonl instead of a mail server.
const sentMails = () =>
  readFileSync('test-results/smtp.jsonl', 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { to: { address: string }[]; subject: string; text: string; headers: Record<string, string>; from: { address: string } })

const sequence = (org: string) => [
  { title: `Eerste mail aan ${org}`, subject: `Wandelaars voor ${org}`, body: `Hoi ${org}, wij hebben jonge vrijwilligers die graag wandelen.`, ps: '' },
  { title: 'Opvolging', subject: '', body: 'Even een herinnering aan mijn vorige mail.', ps: '' },
  { title: 'Laatste', subject: '', body: 'Ik laat het hierbij; de deur staat open.', ps: '' },
]

test('approved mails go out on their own, within the cap, and an answer stops the follow-ups', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)

  // His own mailbox, with a cap of two a day.
  await page.goto('/settings')
  const mail = page.locator('#mail')
  await mail.getByLabel('Mailprovider').selectOption('transip')
  await expect(mail.getByLabel('SMTP-server')).toHaveValue('smtp.transip.email')
  await mail.getByLabel('Gebruikersnaam').fill('laurens@rondje.test')
  await mail.getByLabel('Wachtwoord').fill('app-wachtwoord')
  await mail.getByLabel('Naam afzender').fill('Laurens van Rondje')
  await mail.getByLabel('Adres afzender').fill('laurens@rondje.test')
  await mail.getByLabel('Maximaal per dag').fill('2')
  await mail.getByText('Automatisch versturen', { exact: true }).click()
  // These test contacts are business addresses: the test says yes to cold mail, which is off by default.
  await mail.getByText('Ook koude mail aan bedrijven', { exact: true }).click()
  await mail.getByRole('button', { name: 'Bewaren' }).click()
  await expect(mail.getByRole('status')).toContainText('Automatisch versturen staat aan')
  await mail.getByRole('button', { name: 'Stuur een testmail naar mezelf' }).click()
  await expect(mail.getByRole('status').filter({ hasText: 'Testmail verstuurd naar laurens@rondje.test' })).toBeVisible()

  // Three new contacts; Claude writes a mail with two follow-ups for each.
  await page.goto('/projects')
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await page.getByRole('link', { name: 'Contacten' }).click()
  const form = page.locator('form').filter({ has: page.getByLabel('Organisatie') })
  for (const org of ['Opvang Noord', 'Opvang Zuid', 'Opvang West']) {
    await form.getByLabel('Organisatie').fill(org)
    await form.getByLabel('Zakelijk e-mailadres').fill(`info@${org.split(' ')[1].toLowerCase()}.test`)
    await form.getByRole('button', { name: 'Contact toevoegen' }).click()
    await expect(page.locator('li.card').filter({ hasText: org })).toBeVisible()
  }
  const batch = await mcpTool(request, 'get_task', { task: 'contact_mails', project: 'Rondje' })
  expect(batch.text).toContain('Opvang Noord')
  expect(batch.text).not.toContain('info@noord.test')

  // One button writes them all in the background; big lists go in parts that never take the same contacts.
  const launched = () => readFileSync('test-results/claude-launch.txt', 'utf8').trim().split('\n').length
  const before = launched()
  await page.getByRole('button', { name: 'Schrijf mails voor 3 nieuwe contacten' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Claude schrijft nu 3 mails' })).toBeVisible()
  expect(launched()).toBe(before + 1)
  const part2 = await mcpTool(request, 'get_task', { task: 'contact_mails', project: 'Rondje', count: 2, offset: 1 })
  expect(part2.text).toContain('Opvang Zuid')
  expect(part2.text).toContain('Opvang West')
  expect(part2.text).not.toContain('Opvang Noord')
  const contacts = JSON.parse((await mcpTool(request, 'list_contacts', { project: 'Rondje' })).text) as { id: string; organization: string }[]
  for (const org of ['Opvang Noord', 'Opvang Zuid', 'Opvang West']) {
    const id = contacts.find((c) => c.organization === org)!.id
    const saved = await mcpTool(request, 'save_emails', { project: 'Rondje', purpose: 'contact', contactId: id, language: 'nl', drafts: sequence(org) })
    expect(saved.text).toContain('met 2 opvolgmails')
  }
  // A better version for the same contact replaces the draft; it never ends up twice.
  const noord = contacts.find((c) => c.organization === 'Opvang Noord')!.id
  const better = await mcpTool(request, 'save_emails', { project: 'Rondje', purpose: 'contact', contactId: noord, language: 'nl', drafts: sequence('Opvang Noord') })
  expect(better.text).toContain('vervangt het vorige concept')

  // One approval for all three.
  await page.reload()
  await expect(page.locator('li.card').filter({ hasText: 'Opvang Noord' }).getByText('2 opvolgmails (na 4 en 11 dagen zonder antwoord)')).toBeVisible()
  await page.getByRole('button', { name: 'Keur 3 concepten goed en plan in' }).click()
  await expect(page.getByRole('status').filter({ hasText: '3 mails in de wachtrij' })).toBeVisible()

  // The outbox sends two (the cap), from his address, each with an opt-out line and header.
  const run = await (await request.post('/api/outbox/run', { headers: { Authorization: `Bearer ${TOKEN}` } })).json()
  expect(run).toMatchObject({ sent: 2, failed: 0 })
  const sent = sentMails().filter((m) => m.subject.startsWith('Wandelaars voor'))
  expect(sent).toHaveLength(2)
  expect(sent[0].from.address).toBe('laurens@rondje.test')
  expect(sent[0].text).toContain('Liever geen mail meer hierover? Laat het even weten, dan stop ik.')
  expect(sent[0].headers['List-Unsubscribe']).toBe('<mailto:laurens@rondje.test?subject=Afmelden>')
  const again = await (await request.post('/api/outbox/run', { headers: { Authorization: `Bearer ${TOKEN}` } })).json()
  expect(again).toMatchObject({ sent: 0, skipped: 'cap' })

  // An answer stops the follow-ups for that contact.
  const first = sent[0].to[0].address
  const org = first === 'info@noord.test' ? 'Opvang Noord' : first === 'info@zuid.test' ? 'Opvang Zuid' : 'Opvang West'
  await page.reload()
  const card = page.locator('li.card').filter({ hasText: org })
  await expect(card.getByText(/^Verstuurd .* · 2 opvolgmails gepland$/)).toBeVisible()
  await card.getByLabel('Status').selectOption('replied')
  await expect(page.locator('.toast')).toContainText('+40 XP')

  await page.goto('/studio?tab=mails')
  await page.getByRole('navigation', { name: 'Project' }).getByRole('link', { name: 'Rondje' }).click()
  await expect(page.getByText('Alles voor de groei van Rondje')).toBeVisible()
  const rows = page.getByRole('list', { name: 'Wachtrij' })
  await expect(rows.locator('li').filter({ hasText: org }).filter({ hasText: 'Opvolging 1' })).toContainText('Gestopt')
  await expect(rows.locator('li').filter({ hasText: 'Verstuurd' })).toHaveCount(2)
  await expect(rows.locator('li').filter({ hasText: 'In de wachtrij' }).filter({ hasText: 'Eerste mail' })).toHaveCount(1)
  await context.close()
})
