import { expect, test } from '@playwright/test'
import { dayOf } from '../src/lib/dates'
import { mcpTool, newVisitor, shot } from './helpers'

// Runs after 10-outcomes: Webstability has numbers and a growth model. An experiment tied to leads is
// measured from start to finish, and what came out becomes a lesson in every later brief.
test('a measured experiment: start, the numbers move, a suggested verdict, and a lesson for Claude', async ({ browser, request }) => {
  const saved = await mcpTool(request, 'save_experiments', {
    project: 'Webstability',
    experiments: [
      {
        title: 'Gratis website-check als lokkertje',
        hypothesis: 'Als we een gratis check aanbieden, vragen meer bezoekers iets aan, omdat ze eerst bewijs willen.',
        channel: 'website',
        steps: ['Zet de knop op de homepage', 'Mail vijf klanten om het te delen'],
        metric: 'aanvragen via het formulier',
        target: '10 in twee weken',
        impact: 8,
        confidence: 6,
        ease: 8,
        cost: '€0',
        metricKey: 'leads',
        targetValue: 10,
        days: 14,
      },
    ],
  })
  expect(saved.isError).toBe(false)

  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  const href = await page.getByRole('link', { name: /Webstability/ }).first().getAttribute('href')
  const id = href!.split('/projects/')[1]
  await page.goto(`/studio?tab=experiments&project=${id}`)
  const card = page.locator('article').filter({ hasText: 'Gratis website-check als lokkertje' })
  await expect(card.getByText('Gemeten met leads, doel 10.')).toBeVisible()
  await card.getByRole('button', { name: 'Start dit experiment' }).click()
  await expect(card.getByText('nog 14 dagen')).toBeVisible()
  await expect(card.getByText(/^Aanvragen: /)).toBeVisible()

  // Claude records today's leads, as he was told: the experiment sees them.
  const told = await mcpTool(request, 'save_metrics', { project: 'Webstability', points: [{ key: 'leads', value: 12, day: dayOf(new Date()), note: 'hij vertelde het' }] })
  expect(told.isError).toBe(false)
  await page.reload()
  await expect(card.locator('.measured')).toContainText('→ 12')
  await card.getByRole('button', { name: 'Afronden' }).click()
  await expect(card.getByText('De cijfers zeggen:')).toContainText('het werkte')
  await expect(card.getByLabel('Wat heb je geleerd?')).toHaveValue(/Aanvragen: .+ → 12 \(doel 10\)\. /)
  await card.getByLabel('Wat heb je geleerd?').fill('Aanvragen: 3 → 12 (doel 10). Ondernemers willen eerst bewijs zien.')
  await card.getByRole('button', { name: 'Het werkte', exact: true }).click()
  await expect(card.getByText('Werkte', { exact: true })).toBeVisible()
  await shot(page, '24-experiment')

  // The lesson is on the numbers page, and in the next brief Claude gets for Webstability.
  await page.goto(`/projects/${id}/numbers`)
  const lessons = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Wat experimenten leerden' }) })
  await expect(lessons.getByText('Gratis website-check als lokkertje')).toBeVisible()
  await expect(lessons.getByText('Ondernemers willen eerst bewijs zien.')).toBeVisible()
  const brief = await mcpTool(request, 'get_task', { task: 'posts', project: 'Webstability' })
  expect(brief.text).toContain('<lessons>')
  expect(brief.text).toMatch(/Gratis website-check als lokkertje: worked \(leads: [\d.]+ → 12 in 14 days\)/)
  await context.close()
})
