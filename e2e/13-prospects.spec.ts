import { expect, test } from '@playwright/test'
import { mcpTool, newVisitor } from './helpers'

// Prospectie: Claude finds businesses, the cockpit reads their phone and address itself, he decides.
// Runs after 03-projects (the starter projects) and 08-mail.

const prospect = (organization: string, website: string) => ({
  organization,
  website,
  city: 'Palamós',
  what: 'Garage voor campers en auto’s',
  howRequestsArrive: 'Een contactformulier met alleen naam, e-mail en bericht',
  observation: 'Hun afspraakknop vraagt geen merk, model of kenteken; kijk zelf: hun contactpagina.',
  fit: 4,
  why: 'Klein, eigenaar zelf in de werkplaats',
  pitch: 'Hola, soy Laurens. En vuestra web el botón de cita no pide la matrícula. ¿Os lo enseño en dos minutos?',
  channel: 'call',
})

test('Claude saves businesses as proposals; the cockpit finds their phone and address without showing them to Claude', async ({ request }) => {
  const saved = await mcpTool(request, 'save_prospects', {
    project: 'Webstability',
    prospects: [prospect('Garage Test', 'https://www.garage.example'), prospect('Werkplaats Groot', 'https://nomail.example')],
  })
  expect(saved.isError).toBe(false)
  expect(saved.text).toContain('Opgeslagen: 2 voorstellen voor Webstability')
  expect(saved.text).not.toContain('info@')
  expect(saved.text).not.toContain('+34')
  const list = JSON.parse(saved.text.slice(saved.text.indexOf('['))) as { id: string; organization: string; phoneFound: boolean; addressFound: boolean }[]
  expect(list.find((p) => p.organization === 'Garage Test')).toMatchObject({ phoneFound: true, addressFound: true })
  expect(list.find((p) => p.organization === 'Werkplaats Groot')).toMatchObject({ phoneFound: true, addressFound: false })

  // The same business twice is never proposed again, also by its website.
  const again = await mcpTool(request, 'save_prospects', { project: 'Webstability', prospects: [prospect('Garage Test BV', 'https://garage.example/')] })
  expect(again.isError).toBe(true)

  // The info mail for when they ask for it on the phone.
  const garage = list.find((p) => p.organization === 'Garage Test')!
  const mail = await mcpTool(request, 'save_emails', {
    project: 'Webstability',
    purpose: 'contact',
    contactId: garage.id,
    language: 'es',
    drafts: [
      { title: 'Info', subject: 'Lo que hablamos por teléfono', body: 'Hola, como os prometí por teléfono, aquí está el ejemplo.', ps: '' },
      { title: 'Opvolging', subject: '', body: 'Una cosa más: funciona en cuatro idiomas.', ps: '' },
      { title: 'Laatste', subject: '', body: 'Último mensaje sobre esto.', ps: '' },
    ],
  })
  expect(mail.isError).toBe(false)

  // The next search skips what is already known.
  const brief = await mcpTool(request, 'get_task', { task: 'prospect', project: 'Webstability' })
  expect(brief.text).toContain('Garage Test (garage.example)')
  expect(brief.text).toContain('save_prospects')

  // Searches that run side by side each take their own slice.
  const part = await mcpTool(request, 'get_task', { task: 'prospect', project: 'Webstability', count: 5, part: 2, parts: 4 })
  expect(part.text).toContain('you are part 2 of 4')
  expect(part.text).toContain('find 5 businesses')
  // What works in 2026 goes with it: for finding businesses, the rules on mail.
  expect(part.text).toContain('<channel_rules>')
  expect(part.text).toContain('LSSI art. 21')
})

test('he says yes (a call on his quests) or no (never again), and the mail goes only when they ask for info', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  // Vandaag names them in the day route; the full list is under the project's contacts.
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Vandaag' }).getByText('2 nieuwe bedrijven')).toBeVisible()
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  await page.getByRole('link', { name: 'Contacten' }).click()

  await expect(page.getByRole('heading', { name: 'Claude zoekt bedrijven voor je' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Voorstellen van Claude \(2\)/ })).toBeVisible()
  const garage = page.getByRole('listitem', { name: 'Voorstel: Garage Test' })
  await expect(garage.getByText('Hun afspraakknop vraagt geen merk')).toBeVisible()
  await expect(garage.getByText('Telefoon gevonden')).toBeVisible()
  await garage.getByText('De infomail die Claude klaarzette').click()
  await expect(garage.getByText('Lo que hablamos por teléfono')).toBeVisible()

  await garage.getByRole('button', { name: 'Ja, ik bel ze' }).click()
  await expect(garage.getByRole('status')).toContainText('Bel Garage Test staat bij je quests van vandaag')

  const groot = page.getByRole('listitem', { name: 'Voorstel: Werkplaats Groot' })
  await groot.getByRole('button', { name: 'Nee' }).click()
  await groot.getByRole('button', { name: 'te groot' }).click()
  await expect(groot.getByRole('status')).toContainText('komt niet meer terug')

  await page.reload()
  await expect(page.getByRole('heading', { name: /Voorstellen van Claude/ })).toHaveCount(0)
  await expect(page.getByText('1 bedrijf overgeslagen')).toBeVisible()
  const card = page.locator('li.card').filter({ hasText: 'Garage Test' })
  await expect(card.getByRole('link', { name: 'Bel +34972000000' })).toBeVisible()

  // After the call: they asked for information, so now the prepared mail goes in the queue.
  await card.getByRole('button', { name: 'Ze willen info' }).click()
  await card.getByRole('button', { name: 'Stuur de infomail' }).click()
  await expect(card.getByText('In de wachtrij, met 2 opvolgmails')).toBeVisible()
  await expect(card.getByText('Toestemming gegeven')).toBeVisible()
  await expect(card.getByLabel('Status')).toHaveValue('drafted')

  await page.goto('/quests')
  await expect(page.getByText('Bel Garage Test').first()).toBeVisible()

  // The switch: five a day for Webstability; a project with marketing off gets no panel at all.
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  await page.getByRole('link', { name: 'Contacten' }).click()
  await page.getByLabel('Bedrijven per werkdag').selectOption('5')
  await expect(page.getByRole('status').filter({ hasText: 'Claude zoekt elke werkdag 5 bedrijven voor Webstability' })).toBeVisible()

  // What he chose goes into the next search: his "no" reason, and that the business he called asked for info.
  const brief = await mcpTool(request, 'get_task', { task: 'prospect', project: 'Webstability' })
  expect(brief.text).toContain('<learning>')
  expect(brief.text).toContain('1× "te groot"')
  expect(brief.text).toContain('asked for information after his call')
  await context.close()
})

test('Claude can sharpen a proposal and let it wait until a day; until then it stays out of his day', async ({ browser, request }) => {
  const saved = await mcpTool(request, 'save_prospects', { project: 'Webstability', prospects: [prospect('Bureau Later', 'https://bureau-later.example')] })
  const bureau = (JSON.parse(saved.text.slice(saved.text.indexOf('['))) as { id: string; organization: string }[]).find((p) => p.organization === 'Bureau Later')!
  const updated = await mcpTool(request, 'update_prospect', { project: 'Webstability', contactId: bureau.id, pitch: 'Hola, soy Laurens. ¿Os enseño en veinte minutos cómo funciona para vuestros clientes?', nextStep: 'Na de demo met de eerste partner', notBefore: '2099-01-02' })
  expect(updated.text).toContain('pas vanaf 2099-01-02')
  const listed = JSON.parse((await mcpTool(request, 'list_contacts', { project: 'Webstability' })).text) as { organization: string; notBefore: string | null; pitch: string }[]
  expect(listed.find((c) => c.organization === 'Bureau Later')).toMatchObject({ notBefore: '2099-01-02' })

  // A business he already decided on cannot be changed this way.
  const garage = listed.find((c) => c.organization === 'Garage Test') as unknown as { id: string }
  expect((await mcpTool(request, 'update_prospect', { project: 'Webstability', contactId: garage.id, fit: 2 })).isError).toBe(true)

  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  await page.getByRole('navigation', { name: 'Onderdelen' }).getByRole('link', { name: 'Contacten' }).click()
  const card = page.getByRole('listitem', { name: 'Voorstel: Bureau Later' })
  await expect(card).toContainText('Vanaf')
  await expect(card).toContainText('Na de demo met de eerste partner')
  await expect(card).toContainText('¿Os enseño en veinte minutos')
  // Not in today's lesson.
  await page.goto('/dag')
  await expect(page.getByRole('heading', { name: 'Bureau Later' })).toHaveCount(0)
  await context.close()
})

test('a project with marketing off gets no prospecting', async ({ browser, request }) => {
  await mcpTool(request, 'save_intake', { project: 'OSRS RSPS', redLines: 'Marketing staat uit. Niets publiek.' })
  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /OSRS RSPS/ }).first().click()
  await page.getByRole('link', { name: 'Contacten' }).click()
  await expect(page.getByRole('heading', { name: 'Contact toevoegen' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Claude zoekt bedrijven voor je' })).toHaveCount(0)
  await context.close()
})
