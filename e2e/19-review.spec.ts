import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { addDays, dayOf } from '../src/lib/dates'
import { mcpTool, newVisitor, shot } from './helpers'

// The weekly review: one press on Vandaag, Claude gets the week of every project (numbers, posts with
// their results, deals, quests) and hands back wins, misses and per project what to stop, continue or
// start. He turns a decision into a quest, keeps a lesson for every next brief, and takes over a target.
const launches = () =>
  readFileSync('test-results/claude-launch.txt', 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { command: string })
const lastTicket = () => launches().at(-1)!.command.match(/ticket ([a-f0-9]{8})/)![1]

test('the weekly review: the week as data, and what he takes over', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  const deadline = addDays(dayOf(new Date()), 120)
  await page.goto('/')
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Weekreview' }) })
  await card.getByRole('button', { name: /Maak de weekreview/ }).click()
  await expect(card.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()

  // The brief: every active project's week, from the cockpit's own facts.
  const brief = await mcpTool(request, 'get_task', { ticket: lastTicket() })
  expect(brief.text).toContain('Task: his weekly review of')
  expect(brief.text).toContain('<project name="Webstability">')
  expect(brief.text).toMatch(/- mrr \(end of week\): /)
  expect(brief.text).toContain('Won: Bakkerij Jansen')
  expect(brief.text).toMatch(/linkedin: "Wat kost een website echt\? \(incl\. onderhoud\)" \(document, [\d-]+ [\d:]+\): 1,800 views/)
  expect(brief.text).toContain('What works (last 60 days)')
  expect(brief.text).toContain('`save_review`')

  const saved = await mcpTool(request, 'save_review', {
    review: {
      headline: 'De eerste deal is binnen; LinkedIn brengt de leads',
      wins: ['Bakkerij Jansen gewonnen (€149 per maand)', 'De prijzencarrousel haalde 1.800 weergaven'],
      misses: ['De offerte voor Studio Noord ligt nog'],
      numbers: 'MRR staat op €149. De meeste weergaven kwamen van LinkedIn.',
      decisions: [
        { project: 'Webstability', kind: 'continue', what: 'Plaats elke week een PDF-carrousel over prijzen', why: 'Die haalde de meeste weergaven' },
        { project: 'Webstability', kind: 'start', what: 'Bel Studio Noord over de offerte', why: 'De volgende stap is te laat' },
        { project: 'Rondje', kind: 'stop', what: 'losse Instagram-foto’s zonder tekst', why: 'Geen bereik' },
      ],
      lessons: [{ project: 'Webstability', lesson: 'Prijzen uitleggen in een carrousel werkt op LinkedIn' }],
      targetChanges: [{ project: 'Webstability', target: 2500, deadline, why: '€3.000 is niet haalbaar in deze tijd' }],
    },
  })
  expect(saved.text).toContain('Opgeslagen: de weekreview')

  await page.reload()
  const review = page.locator('section[aria-labelledby="review-title"]')
  await expect(review.getByRole('heading', { name: 'De eerste deal is binnen; LinkedIn brengt de leads' })).toBeVisible()
  await expect(review.getByText('Bakkerij Jansen gewonnen (€149 per maand)')).toBeVisible()
  for (const group of ['Stoppen', 'Doorgaan', 'Beginnen']) await expect(review.getByRole('heading', { name: group })).toBeVisible()

  // A decision becomes a quest for this week.
  const call = review.locator('li').filter({ hasText: 'Bel Studio Noord over de offerte' })
  await call.getByRole('button', { name: 'Maak quest' }).click()
  await expect(call.getByText('Quest staat erin')).toBeVisible()
  const stop = review.locator('li').filter({ hasText: 'losse Instagram-foto’s' })
  await stop.getByRole('button', { name: 'Maak quest' }).click()
  await expect(stop.getByText('Quest staat erin')).toBeVisible()

  // A lesson goes into every next brief.
  const lesson = review.locator('li').filter({ hasText: 'Prijzen uitleggen in een carrousel' })
  await lesson.getByRole('button', { name: 'Bewaar als les' }).click()
  await expect(lesson.getByText('Bewaard als les')).toBeVisible()

  // A new target, measured from today.
  const target = review.locator('li').filter({ hasText: '€3.000 is niet haalbaar' })
  await expect(target).toContainText('MRR')
  await target.getByRole('button', { name: 'Overnemen' }).click()
  await expect(target.getByText('Overgenomen')).toBeVisible()
  await shot(page, '34-review')

  await page.goto('/quests')
  await expect(page.getByText('Bel Studio Noord over de offerte')).toBeVisible()
  await expect(page.getByText('Stop: losse Instagram-foto’s zonder tekst')).toBeVisible()
  const numbers = await mcpTool(request, 'get_numbers', { project: 'Webstability', key: 'mrr', weeks: 2 })
  expect(numbers.text).toMatch(new RegExp(`2\\.500 vóór ${deadline}`))
  const next = await mcpTool(request, 'get_task', { task: 'experiments', project: 'Webstability' })
  expect(next.text).toContain('From the weekly review: Prijzen uitleggen in een carrousel werkt op LinkedIn')
  await context.close()
})
