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

  // Posts come with a day: planned in the calendar, on that day in his lesson.
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const posts = await mcpTool(request, 'save_posts', {
    project: 'Webstability',
    platform: 'instagram',
    language: 'nl',
    posts: [{ title: 'Week 1', format: 'carousel', hook: 'Zo komt een aanvraag binnen', caption: 'Drie stappen.', hashtags: ['#werkbon'], visualBrief: 'Schermen', bestTime: 'di 19:00', plannedFor: tomorrow }],
  })
  expect(posts.text).toContain('1 ingepland in de kalender')

  // Costs: what is still open, added up on the money page; he pays, the cockpit only counts.
  await page.goto('/geld')
  await expect(page.getByRole('heading', { name: 'Geld', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nog te regelen om te groeien' })).toBeVisible()
  await context.close()
})
