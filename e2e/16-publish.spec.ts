import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { addDays, dayOf } from '../src/lib/dates'
import { mcpTool, newVisitor, shot } from './helpers'

// Publishing what he approved: he connects LinkedIn (his own login in his browser), Instagram (a
// token, and a Blob store for the files) and TikTok (login with PKCE); approved posts get their
// moment, "Nu plaatsen" puts them online, a passing failure is tried again, a refusal waits for him,
// and the emergency stop holds everything. LinkedIn, Instagram and TikTok answer from fixtures.
const LOG = 'test-results/fixture-requests.jsonl'
const BLOB = 'test-results/blob.jsonl'
const lines = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : [])
const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0

test('connect the channels, approve, publish, and the stop', async ({ browser, request }) => {
  // Drawing the slides and the TikTok slideshow takes a while on a busy test machine.
  test.setTimeout(300_000)
  for (const f of [LOG, BLOB]) rmSync(f, { force: true })
  const { context, page } = await newVisitor(browser)
  await page.goto('/settings#channels')
  const channels = page.locator('#channels')

  // LinkedIn: the app, then logging in in his own browser; the answer comes back to the local address.
  const li = channels.locator('#channel-linkedin')
  await expect(li.getByText('http://localhost:3300/api/oauth/linkedin/callback')).toBeVisible()
  await li.getByLabel('Client ID').fill('86fixture42')
  await li.getByLabel('Client Secret').fill('li-secret-fixture')
  await li.getByRole('button', { name: 'Bewaren' }).click()
  await expect(li.getByRole('status')).toContainText('Druk nu op Koppel LinkedIn')
  await li.getByRole('button', { name: 'Koppel LinkedIn' }).click()
  const liLink = new URL((await li.getByRole('link', { name: 'Open LinkedIn om in te loggen' }).getAttribute('href'))!)
  expect(liLink.origin + liLink.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization')
  expect(liLink.searchParams.get('scope')).toBe('openid profile w_member_social')
  const liState = liLink.searchParams.get('state')!
  const back = await request.get(`/api/oauth/linkedin/callback?code=li-code&state=${liState}`)
  expect(await back.text()).toContain('LinkedIn is gekoppeld als Test Ondernemer')
  expect((await request.get(`/api/oauth/linkedin/callback?code=li-code&state=${liState}`)).status()).toBe(400)
  await expect(li.getByText('Als Test Ondernemer', { exact: false })).toBeVisible({ timeout: 20_000 })

  // Instagram: a wrong token is refused; a good one finds the account. Then the Blob store.
  const ig = channels.locator('#channel-instagram')
  await ig.getByLabel('Project').selectOption({ label: 'Webstability' })
  await ig.getByLabel('Instagram-token').fill('IGbad-token-that-instagram-does-not-know-1234')
  await ig.getByRole('button', { name: 'Koppel' }).click()
  await expect(ig.getByRole('alert')).toContainText('Instagram kent dit token niet')
  await ig.getByLabel('Instagram-token').fill('IGAAfixture-token-for-webstability-0123456789')
  await ig.getByRole('button', { name: 'Koppel' }).click()
  await expect(ig.getByRole('status')).toContainText('Gekoppeld: @webstability')
  await ig.getByLabel('Blob-token').fill('vercel_blob_rw_fixture_0123456789')
  await ig.getByRole('button', { name: 'Bewaren' }).click()
  await expect(ig.getByText('Ingesteld', { exact: true })).toBeVisible()

  // TikTok: the app, then a login per project (with PKCE).
  const tt = channels.locator('#channel-tiktok')
  await tt.getByLabel('Client key').fill('awfixturekey01')
  await tt.getByLabel('Client secret').fill('tt-secret-fixture')
  await tt.getByRole('button', { name: 'Bewaren' }).click()
  await expect(tt.getByRole('status')).toContainText('Koppel nu per project')
  await tt.getByLabel('TikTok voor project').selectOption({ label: 'Rondje' })
  await tt.getByRole('button', { name: 'Koppel TikTok' }).click()
  const ttLink = new URL((await tt.getByRole('link', { name: 'Open TikTok om in te loggen' }).getAttribute('href'))!)
  expect(ttLink.searchParams.get('code_challenge')).toMatch(/^[0-9a-f]{64}$/)
  expect(ttLink.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:3300/api/oauth/tiktok/callback')
  const ttBack = await request.get(`/api/oauth/tiktok/callback?code=tt-code&state=${ttLink.searchParams.get('state')}`)
  expect(await ttBack.text()).toContain('TikTok is gekoppeld als rondje.app')
  await page.reload()
  await expect(tt.getByText('rondje.app')).toBeVisible()
  await shot(page, '30-channels')
  const settingsHtml = await page.content()
  for (const secret of ['li-secret-fixture', 'li-fixture-token', 'IGAAfixture', 'vercel_blob_rw_fixture', 'tt-secret-fixture', 'act.fixture', 'rft.fixture']) expect(settingsHtml).not.toContain(secret)

  // Claude's week: a LinkedIn document and an Instagram carousel for Webstability, a TikTok for Rondje.
  const today = dayOf(new Date())
  const day = (n: number) => addDays(today, n)
  const items = [
    {
      project: 'Webstability',
      channel: 'linkedin',
      format: 'document',
      title: 'Prijzen uitgelegd',
      hook: 'Wat kost een website echt? (incl. onderhoud)',
      text: 'Wat kost een website echt? (incl. onderhoud)\n\nDe rekensom die ik met klanten maak.',
      hashtags: ['mkb', 'website'],
      day: day(4),
      slides: [{ title: 'Wat kost een website?' }, { title: 'Bouw', body: 'Eenmalig' }, { title: 'Onderhoud', body: 'Per maand' }],
    },
    { project: 'Webstability', channel: 'linkedin', format: 'text', title: 'Even druk', hook: 'Dit gaat eerst mis', text: 'FAIL-ME: deze post lukt pas de tweede keer.', day: day(5) },
    { project: 'Webstability', channel: 'linkedin', format: 'text', title: 'Geweigerd', hook: 'Dit mag niet', text: 'REFUSE-ME: deze post weigert LinkedIn.', day: day(6) },
    {
      project: 'Webstability',
      channel: 'instagram',
      format: 'carousel',
      title: '4 tips',
      hook: '4 tips voor een snellere site',
      text: '4 tips voor een snellere site. Bewaar dit.',
      hashtags: ['webdesign'],
      day: day(4),
      slides: [{ title: '4 tips voor een snellere site' }, { title: 'WebP', body: 'Kleinere beelden' }, { title: 'Lazy loading' }, { title: 'Bewaar dit' }],
    },
    ...(ffmpeg
      ? [{ project: 'Rondje', channel: 'tiktok', format: 'carousel', title: 'Routes', hook: '3 routes met je hond', text: 'Bewaar dit #hond', day: day(4), slides: [{ title: '3 routes met je hond' }, { title: 'Park' }, { title: 'Bos' }] }]
      : []),
  ]
  const saved = await mcpTool(request, 'save_content_week', { items })
  expect(saved.isError).toBe(false)
  await page.goto('/content')
  const card = (text: string) => page.locator('article').filter({ hasText: text })
  // Wait until the cockpit drew everything: the PDF's slides, the carousel and (with ffmpeg) the slideshow.
  await expect
    .poll(
      async () => {
        await page.reload()
        const drawn = (await card('Wat kost een website echt?').locator('img').count()) === 3 && (await card('4 tips voor een snellere site').locator('img').count()) === 4
        return drawn && (!ffmpeg || (await card('3 routes met je hond').locator('video').count()) === 1)
      },
      { timeout: 120_000, intervals: [2000] },
    )
    .toBe(true)

  // Approved posts on connected channels get their moment.
  await page.getByRole('button', { name: /Week goedkeuren/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /\d+ goedgekeurd\./ })).toBeVisible()
  await page.reload()
  await expect(card('Wat kost een website echt?').getByText(/^Gepland · /)).toBeVisible()

  // LinkedIn: the PDF goes up as a document, the text in LinkedIn's notation.
  await card('Wat kost een website echt?').getByRole('button', { name: 'Nu plaatsen' }).click()
  await expect(card('Wat kost een website echt?').getByRole('status')).toHaveText('Geplaatst.')
  await page.reload()
  await expect(card('Wat kost een website echt?').getByRole('link', { name: 'Bekijk op LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/feed/update/urn:li:share:7380000000000000001/')
  const liPost = lines(LOG).find((l) => l.platform === 'linkedin' && l.call === 'post')!
  expect(liPost.media).toBe('urn:li:document:F1')
  expect(liPost.commentary).toContain('\\(incl. onderhoud\\)')
  expect(liPost.commentary).toContain('{hashtag|\\#|mkb}')
  expect(lines(LOG).some((l) => l.call === 'upload' && l.what === 'document-1' && Number(l.bytes) > 1000)).toBe(true)

  // Instagram: four JPEGs as carousel items, the carousel, publishing; the Blob files are removed again.
  await card('4 tips voor een snellere site').getByRole('button', { name: 'Nu plaatsen' }).click()
  await expect(card('4 tips voor een snellere site').getByRole('status')).toHaveText('Geplaatst.')
  const igCalls = lines(LOG).filter((l) => l.platform === 'instagram')
  expect(igCalls.filter((l) => l.call === 'container' && l.carousel_item)).toHaveLength(4)
  expect(igCalls.find((l) => l.media_type === 'CAROUSEL')).toMatchObject({ children: 4, caption: '4 tips voor een snellere site. Bewaar dit.\n\n#webdesign' })
  expect(igCalls.some((l) => l.call === 'publish')).toBe(true)
  const blob = lines(BLOB)
  expect(blob.filter((b) => b.put && b.contentType === 'image/jpeg')).toHaveLength(4)
  expect((blob.find((b) => b.del)?.del as string[]).length).toBe(4)

  // TikTok: the slideshow into his drafts.
  if (ffmpeg) {
    await card('3 routes met je hond').getByRole('button', { name: 'Nu plaatsen' }).click()
    await expect(card('3 routes met je hond').getByRole('status')).toHaveText('Geplaatst.')
    await page.reload()
    await expect(card('3 routes met je hond').getByText('Staat in je TikTok-concepten')).toBeVisible()
    expect(lines(LOG).find((l) => l.platform === 'tiktok' && l.call === 'upload')?.range).toMatch(/^bytes 0-\d+\/\d+$/)
  }

  // A passing failure waits and tries again; a refusal waits for him.
  await card('FAIL-ME').getByRole('button', { name: 'Nu plaatsen' }).click()
  await expect(card('FAIL-ME').getByRole('status')).toContainText('probeert het later opnieuw')
  await page.reload()
  await expect(card('FAIL-ME').getByText(/Vorige poging: LinkedIn gaf geen antwoord/)).toBeVisible()
  await card('REFUSE-ME').getByRole('button', { name: 'Nu plaatsen' }).click()
  await expect(card('REFUSE-ME').getByRole('status')).toContainText('LinkedIn weigerde de post (422)')
  await page.reload()
  await expect(card('REFUSE-ME').getByText('Lukte niet')).toBeVisible()
  await expect(card('REFUSE-ME').getByRole('button', { name: 'Opnieuw proberen' })).toBeVisible()
  await shot(page, '31-publish')

  // The emergency stop holds everything.
  await page.goto('/settings#channels')
  await channels.getByRole('checkbox', { name: /Plaatsen op pauze/ }).check()
  await expect(channels.getByText('Op pauze')).toBeVisible()
  const run = await page.request.post('/api/publish/run')
  expect(await run.json()).toEqual({ ran: 'paused' })
  await channels.getByRole('checkbox', { name: /Plaatsen op pauze/ }).uncheck()
  const html = await page.content()
  for (const secret of ['li-fixture-token', 'IGAAfixture', 'vercel_blob_rw_fixture', 'act.fixture']) expect(html).not.toContain(secret)
  await context.close()
})
