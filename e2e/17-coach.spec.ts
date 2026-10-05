import { expect, test } from '@playwright/test'
import { mcpTool, newVisitor } from './helpers'

// The coach: a growth checklist per business (what the cockpit checks, what Claude reads, what he ticks
// off), the costs of what is still open, and one best next step on Vandaag.

test('Claude fills in the checklist and gives the best next step; he ticks it off from Vandaag', async ({ browser, request }) => {
  const checklist = await mcpTool(request, 'save_checklist', { project: 'Webstability', items: [{ key: 'gbp', status: 'todo', note: 'Nog geen profiel gevonden' }, { key: 'trustpilot', status: 'na' }] })
  expect(checklist.text).toContain('Checklist van Webstability bijgewerkt (2 stappen)')
  expect((await mcpTool(request, 'save_checklist', { project: 'Webstability', items: [{ key: 'bestaat-niet', status: 'done' }] })).isError).toBe(true)

  const brief = await mcpTool(request, 'get_task', { task: 'coach' })
  expect(brief.text).toContain('he is stuck and asks his coach what to do now')
  expect(brief.text).toContain('save_coach')
  const project = await mcpTool(request, 'get_project', { project: 'Webstability' })
  expect(project.text).toContain('<setup>')
  expect(project.text).toContain('Google Bedrijfsprofiel (Nog geen profiel gevonden)')

  const saved = await mcpTool(request, 'save_coach', {
    project: 'Webstability',
    title: 'Maak je Google Bedrijfsprofiel',
    why: 'Zo sta je in Google Maps in je regio. Recensies komen daar bij.',
    steps: ['Ga naar business.google.com', 'Kies servicegebied', 'Rond de verificatie af'],
    who: 'jij',
    cost: 'gratis',
    setupKey: 'gbp',
  })
  expect(saved.text).toContain('Maak je Google Bedrijfsprofiel')

  const { context, page } = await newVisitor(browser)
  await page.goto('/')
  const coach = page.getByRole('region', { name: 'Je coach' })
  await expect(coach).toContainText('Maak je Google Bedrijfsprofiel')
  await expect(coach).toContainText('Ga naar business.google.com')
  await expect(coach.getByRole('button', { name: 'Ik weet het even niet' })).toBeVisible()
  await coach.getByRole('button', { name: 'Gedaan' }).click()
  await expect(coach.getByRole('status')).toContainText('Afgevinkt')

  // On the project page: the checklist with the step done, Trustpilot left out (not needed).
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  const setup = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Klaar om te groeien' }) })
  await expect(setup.getByRole('listitem', { name: 'Google Bedrijfsprofiel' }).getByLabel('Geregeld')).toBeVisible()
  await expect(setup.getByRole('listitem', { name: 'Trustpilot-profiel' })).toHaveCount(0)
  // He marks a step himself.
  const domain = setup.getByRole('listitem', { name: 'Eigen domeinnaam' })
  await domain.getByRole('button', { name: 'Gedaan' }).click()
  await expect(domain.getByLabel('Geregeld')).toBeVisible()

  // Costs: what is still open, added up; he pays, the cockpit only counts.
  await page.goto('/kosten')
  await expect(page.getByRole('heading', { name: 'Kosten', level: 1 })).toBeVisible()
  await expect(page.getByText('Betalen doe jij; Cockpit rekent alleen.')).toBeVisible()
  await context.close()
})
