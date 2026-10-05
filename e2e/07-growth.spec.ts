import { expect, test } from '@playwright/test'
import { articlesFixture, experimentsFixture, linkedinFixture } from '../src/lib/ai/fixtures'
import { mcpTool, newVisitor, shot } from './helpers'

// Runs after 05: Rondje has drafts and contacts. The test plays Claude Code's part over MCP.
test('organic growth: articles, a growth experiment and LinkedIn, from Claude Code to the hub', async ({ browser, request }) => {
  const brief = await mcpTool(request, 'get_task', { task: 'experiments', project: 'Rondje' })
  expect(brief.text).toContain('five organic growth experiments')
  expect(brief.text).toContain('`save_experiments`')
  for (const [tool, args] of [
    ['save_articles', { project: 'Rondje', language: 'nl', ...articlesFixture() }],
    ['save_experiments', { project: 'Rondje', ...experimentsFixture() }],
    ['save_linkedin', { project: 'Rondje', linkedin: linkedinFixture() }],
  ] as const) {
    const saved = await mcpTool(request, tool, args as Record<string, unknown>)
    expect(saved.isError, tool).toBe(false)
    expect(saved.text, tool).toContain('Opgeslagen')
  }

  const { context, page } = await newVisitor(browser)
  await page.goto('/studio')
  await page.getByRole('navigation', { name: 'Project' }).getByRole('link', { name: 'Rondje' }).click()
  await expect(page.getByText('Alles voor de groei van Rondje')).toBeVisible()

  // Articles: the full one as markdown, the others as an outline; publishing counts as a post.
  await page.getByRole('link', { name: 'Artikelen' }).click()
  const article = page.locator('article').filter({ hasText: 'Vrijwilligerswerk met honden: zo begin je in 4 stappen' })
  await expect(article.getByText('/vrijwilligerswerk-met-honden')).toBeVisible()
  await expect(article.getByRole('button', { name: 'Kopieer markdown' })).toBeVisible()
  await article.getByRole('button', { name: 'Gepubliceerd' }).click()
  await expect(page.locator('.toast')).toContainText('+15 XP')

  // Experiments: highest ICE first; start one, finish it with what was learned, and earn XP.
  await page.getByRole('navigation', { name: 'Onderdeel' }).getByRole('link', { name: 'Ideeën' }).click()
  await page.getByRole('navigation', { name: 'Ideeën' }).getByRole('link', { name: 'Experimenten' }).click()
  const backlog = page.getByRole('region', { name: 'Klaar om te starten' })
  await expect(backlog.locator('article').first()).toContainText('Flyer met QR bij de bieb van de universiteit')
  await backlog.locator('article').first().getByRole('button', { name: 'Start dit experiment' }).click()
  const running = page.getByRole('region', { name: 'Loopt' }).locator('article').filter({ hasText: 'Flyer met QR' })
  await running.getByRole('button', { name: 'Afronden' }).click()
  await running.getByLabel('Wat heb je geleerd?').fill('12 aanmeldingen, vooral via de bieb')
  await running.getByRole('button', { name: 'Het werkte', exact: true }).click()
  await expect(page.locator('.toast')).toContainText('+30 XP')
  const done = page.getByRole('region', { name: 'Afgerond' }).locator('article').filter({ hasText: 'Flyer met QR' })
  await expect(done).toContainText('12 aanmeldingen, vooral via de bieb')
  await shot(page, '11-experiments')

  // The next round learns from it.
  const next = await mcpTool(request, 'get_task', { task: 'experiments', project: 'Rondje' })
  expect(next.text).toContain('Flyer met QR bij de bieb van de universiteit: worked (12 aanmeldingen, vooral via de bieb)')

  // The overview: numbers and what to do next.
  await page.getByRole('link', { name: 'Overzicht' }).click()
  await expect(page.locator('.kpi').filter({ hasText: 'Experimenten' })).toContainText('1 gewonnen')
  await shot(page, '12-hub')

  // LinkedIn on the brain: posts open LinkedIn with the text filled in.
  await page.goto('/projects')
  await page.getByRole('link', { name: /Rondje/ }).first().click()
  await page.getByRole('link', { name: 'Plan', exact: true }).click()
  await expect(page.getByText('Bouwer van Rondje: jongeren en asielhonden samen op pad')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Post op LinkedIn' }).first()).toHaveAttribute('href', /^https:\/\/www\.linkedin\.com\/feed\/\?shareActive=true&text=Elke%20hond/)
  await context.close()
})
