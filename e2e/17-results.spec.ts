import { spawnSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { dayLabel, dayOf } from '../src/lib/dates'
import { mcpTool, newVisitor, shot } from './helpers'

// Learning what works, after 16-publish put posts online: the cockpit fetches what Instagram and
// TikTok say about them (and which video his TikTok draft became), he types in LinkedIn's numbers,
// followers become numbers of the project, and Claude's next content week gets it all as data.
const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0

test('the numbers of his posts, and Claude doing what works', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/content')
  const results = page.locator('section[aria-labelledby="results-title"]')
  const card = (text: string) => page.locator('article').filter({ hasText: text })
  const today = dayLabel(dayOf(new Date()))

  // Before fetching: LinkedIn (and the TikTok draft) wait for numbers.
  const toFill = results.locator('details.result-fill')
  await expect(toFill.filter({ hasText: 'Wat kost een website echt?' })).toBeVisible()
  if (ffmpeg) await expect(toFill.filter({ hasText: '3 routes met je hond' })).toBeVisible()

  // Instagram's insights and TikTok's numbers, now instead of in the daily round.
  await results.getByRole('button', { name: 'Cijfers ophalen' }).click()
  await expect(results.getByRole('status')).toHaveText(ffmpeg ? '2 posts gemeten, volgers bijgewerkt.' : '1 post gemeten, volgers bijgewerkt.')
  await page.reload()
  await expect(results.getByRole('heading', { name: 'Instagram · 1 post · middenwaarde 1.240 bereikt · 8,4% interactie' })).toBeVisible()
  await expect(results.getByText('1.240 weergaven · 8,4% interactie · 50 likes · 4 reacties · 9 gedeeld · 41 bewaard').first()).toBeVisible()
  await expect(results.getByText(/Volgers:.*Instagram 1\.204/)).toBeVisible()
  if (ffmpeg) {
    // He posted the draft in the app: TikTok says which video it became, with its numbers and link.
    await expect(results.getByText('5.300 weergaven · 9,3% interactie · 410 likes · 22 reacties · 61 gedeeld').first()).toBeVisible()
    await expect(results.getByText(/TikTok 310/)).toBeVisible()
    await expect(toFill.filter({ hasText: '3 routes met je hond' })).toHaveCount(0)
    await expect(card('3 routes met je hond').getByRole('link', { name: 'Bekijk op TikTok' })).toHaveAttribute('href', 'https://www.tiktok.com/@rondje.app/video/7380000000000000123')
    await expect(card('3 routes met je hond').getByText('Staat in je TikTok-concepten')).toHaveCount(0)
  }
  // The week card says it too.
  await expect(card('4 tips voor een snellere site').getByText('1.240 weergaven · 8,4% interactie')).toBeVisible()

  // LinkedIn: he types in what LinkedIn shows him; a link to somewhere else is refused.
  const li = toFill.filter({ hasText: 'Wat kost een website echt?' })
  await li.locator('summary').click()
  await expect(li.locator('summary')).toContainText(`LinkedIn · Webstability · ${today}`)
  await li.getByLabel('Weergaven').fill('1.800')
  await li.getByLabel('Likes').fill('42')
  await li.getByLabel('Reacties').fill('7')
  await li.getByLabel('Gedeeld').fill('3')
  const link = li.getByLabel('Link van de post')
  const permalink = await link.inputValue()
  expect(permalink).toBe('https://www.linkedin.com/feed/update/urn:li:share:7380000000000000001/')
  await link.fill('https://evil.test/post')
  await li.getByRole('button', { name: 'Bewaren' }).click()
  await expect(li.getByRole('alert')).toHaveText('Plak de link van de post op LinkedIn.')
  await link.fill(permalink)
  await li.getByRole('button', { name: 'Bewaren' }).click()
  // With its numbers in, the post moves from "Nog in te vullen" to the results.
  await expect(toFill.filter({ hasText: 'Wat kost een website echt?' })).toHaveCount(0)
  await expect(results.getByRole('heading', { name: 'LinkedIn · 1 post · middenwaarde 1.800 bereikt · 2,9% interactie' })).toBeVisible()
  await page.reload()
  await expect(card('Wat kost een website echt?').getByText('1.800 weergaven · 2,9% interactie · 42 likes · 7 reacties · 3 gedeeld')).toBeVisible()

  // Posted by hand: on record too, so he can add its numbers later.
  await card('REFUSE-ME').getByRole('button', { name: 'Geplaatst' }).click()
  await expect(toFill.filter({ hasText: 'Dit mag niet' })).toBeVisible()
  await shot(page, '32-results')

  // Followers and reach are numbers of the project now.
  const followers = await mcpTool(request, 'get_numbers', { project: 'Webstability', key: 'instagram_followers', weeks: 2 })
  expect(followers.text).toContain('1204')
  const reach = await mcpTool(request, 'get_numbers', { project: 'Webstability', key: 'social_reach', weeks: 2 })
  expect(reach.text).toContain('3040')

  // Claude reads it, and the next content week gets it as data.
  const read = await mcpTool(request, 'get_content_results', { project: 'Webstability' })
  expect(read.text).toContain('instagram: 1 measured post, median 1,240 reached, median engagement 8.4%')
  expect(read.text).toContain('linkedin: 1 measured post, median 1,800 reached')
  expect(read.text).toContain('Followers: instagram 1,204')
  const brief = await mcpTool(request, 'get_task', { task: 'content' })
  expect(brief.text).toContain('<performance project="Webstability">')
  expect(brief.text).toMatch(/- best: "4 tips voor een snellere site" \(carousel, [\d-]+ [\d:]+\): 1,240 views, 8\.4% engagement, 41 saved, 9 shared, 4 comments/)
  expect(brief.text).toContain('Do what works')

  const html = await page.content()
  for (const secret of ['li-fixture-token', 'IGAAfixture', 'act.fixture', 'rft.fixture']) expect(html).not.toContain(secret)
  await context.close()
})
