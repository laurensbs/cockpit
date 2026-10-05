import { expect, test } from '@playwright/test'
import { mcpTool, newVisitor } from './helpers'

// Runs after 03-projects: the five starter projects exist.

test('Claude fills in the intake through MCP, and he sees it in the project', async ({ browser, request }) => {
  const saved = await mcpTool(request, 'save_intake', {
    project: 'Webstability',
    oneLiner: 'Aanvraagformulieren die als werkbon binnenkomen, voor servicebedrijven aan de Costa Brava.',
    what: 'Een aanvraagformulier op de site van de klant; elke aanvraag komt als werkbon met nummer in een werkpaneel.',
    audience: 'Kleine servicebedrijven: garages, stallingen, installateurs.',
    goal: 'Eerste betaalde pilot vóór vr 30 okt 2026 (besluit 1 okt).',
    localPath: '/Users/laurens/naamloze map/webstability',
    languages: ['nl', 'es', 'en'],
    markets: ['ES', 'NL'],
  })
  expect(saved.isError).toBe(false)
  expect(saved.text).toContain('Intake van Webstability bijgewerkt')

  // Nothing changes without a field, and a relative folder is refused.
  expect((await mcpTool(request, 'save_intake', { project: 'Webstability' })).isError).toBe(true)
  expect((await mcpTool(request, 'save_intake', { project: 'Webstability', localPath: 'webstability' })).isError).toBe(true)

  const project = await mcpTool(request, 'get_project', { project: 'Webstability' })
  expect(project.text).toContain('werkbon met nummer')

  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  await expect(page.getByText('Aanvraagformulieren die als werkbon binnenkomen').first()).toBeVisible()
  await context.close()
})

test('a pasted list adds many contacts at once, names what it cannot take, and skips what is there', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  await page.getByRole('link', { name: 'Contacten' }).click()

  // One contact by hand first: the form is empty again afterwards.
  const form = page.locator('form').filter({ has: page.getByLabel('Organisatie') })
  await form.getByLabel('Organisatie').fill('Garage Eerst')
  await form.getByRole('button', { name: 'Contact toevoegen' }).click()
  await expect(page.locator('li.card').filter({ hasText: 'Garage Eerst' })).toBeVisible()
  await expect(form.getByLabel('Organisatie')).toHaveValue('')

  await page.getByText('Plak een lijst').click()
  await page.getByLabel('Lijst met contacten').fill(
    [
      'Organisatie;Naam;E-mail;Website;Basis;Notitie',
      'Camper Test;;info@camper.example;camper.example;zakelijk;Werkplaats; officieel dealer',
      'Partner Test;Sam;;partner.example;relatie;Partnerpilot',
      'garage eerst;;;;;dubbel',
      'Kapot;;geen-adres',
    ].join('\n'),
  )
  await page.getByRole('button', { name: 'Contacten toevoegen' }).click()
  await expect(page.getByRole('status').filter({ hasText: '2 contacten toegevoegd' })).toContainText('1 stond er al')
  await expect(page.getByRole('status').filter({ hasText: '2 contacten toegevoegd' })).toContainText('regel 5: e-mailadres klopt niet')
  const camper = page.locator('li.card').filter({ hasText: 'Camper Test' })
  await expect(camper).toContainText('info@camper.example')
  await expect(camper).toContainText('Werkplaats; officieel dealer')
  await expect(page.locator('li.card').filter({ hasText: 'Partner Test' })).toContainText('Bestaande relatie')

  // Claude sees the organisations and notes, never the addresses.
  const listed = await mcpTool(request, 'list_contacts', { project: 'Webstability' })
  expect(listed.text).toContain('Camper Test')
  expect(listed.text).not.toContain('info@camper.example')
  await context.close()
})
