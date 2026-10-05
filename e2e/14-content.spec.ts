import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { addDays, dayOf } from '../src/lib/dates'
import { mcpTool, newVisitor, shot } from './helpers'

// The content week: he sets Webstability's house style and rhythm, Claude makes the week through MCP,
// the cockpit draws the slides, a PDF and a reel cover; he edits, approves, posts a forum answer and has
// one item redone.
const launches = () =>
  readFileSync('test-results/claude-launch.txt', 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { command: string })
const lastTicket = () => launches().at(-1)!.command.match(/ticket ([a-f0-9]{8})/)![1]

test('the content week: house style, Claude’s batch, drawn slides, approving and redoing', async ({ browser, request }) => {
  const { context, page } = await newVisitor(browser)

  // The Monday autopilot for content is his choice, in Settings.
  await page.goto('/settings')
  const auto = page.getByRole('checkbox', { name: /Contentweek: elke maandagochtend automatisch/ })
  if (await auto.count()) {
    await auto.check()
    await expect(auto).toBeChecked()
  }

  await page.goto('/content')
  await expect(page.getByRole('heading', { name: 'Contentweek', level: 1 })).toBeVisible()

  // Webstability's house style and rhythm; the sample follows the form.
  await page.locator('details').filter({ hasText: 'Webstability' }).locator('summary').click()
  const form = page.getByRole('form', { name: 'Huisstijl en ritme van Webstability' })
  await form.getByLabel('Accentkleur', { exact: true }).fill('#2f6bff')
  await form.getByLabel('Handle op de beelden').fill('webstability')
  await form.getByLabel('LinkedIn').fill('2')
  await form.getByLabel('Instagram').fill('2')
  await form.getByLabel('TikTok').fill('1')
  await form.getByLabel('Forums').fill('1')
  await expect(form.getByRole('img', { name: /Voorbeeld/ })).toHaveAttribute('src', /accent=%232f6bff/)
  await expect.poll(() => form.getByRole('img', { name: /Voorbeeld/ }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1080)
  await form.getByRole('button', { name: 'Bewaren' }).click()
  await expect(form.getByRole('status')).toContainText('Bewaard')

  // Claude gets the week's brief through a ticket: the playbooks, and each project with its rhythm.
  await page.getByRole('button', { name: /Maak de contentweek/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()
  const brief = await mcpTool(request, 'get_task', { ticket: lastTicket() })
  expect(brief.text).toContain('Task: the content week')
  expect(brief.text).toContain('LinkedIn — principle: give value')
  expect(brief.text).toContain('<project name="Webstability">')
  expect(brief.text).toContain('Rhythm this week (items per channel): linkedin 2, instagram 2, tiktok 1, forum 1')
  expect(brief.text).toContain('Handle on the slides: @webstability')
  expect(brief.text).toContain('`save_content_week`')

  const today = dayOf(new Date())
  const day = (n: number) => addDays(today, n)
  const saved = await mcpTool(request, 'save_content_week', {
    items: [
      {
        project: 'Webstability',
        channel: 'linkedin',
        format: 'document',
        title: 'Checklist website',
        hook: 'Ik checkte 40 mkb-sites. 31 maakten dezelfde fout.',
        text: 'Ik checkte 40 mkb-sites.\n\nDe fout: geen duidelijke volgende stap.\n\nHier is de checklist die ik gebruik.',
        hashtags: ['mkb', 'website'],
        day: day(1),
        slides: [{ title: 'De website-checklist' }, { title: 'Wie help je?', body: 'In de eerste zin' }, { title: 'Eén knop', body: 'Per pagina één volgende stap' }, { title: 'Snel', body: 'Onder de 2 seconden' }, { title: 'Bewaar dit' }],
        goal: 'leads',
        why: 'Leads lekken bij bezoekers → aanvragen.',
      },
      {
        project: 'Webstability',
        channel: 'linkedin',
        format: 'text',
        title: 'Dubbel op dezelfde dag',
        hook: 'Dit mag niet',
        text: 'Twee LinkedIn-posts op één dag.',
        day: day(1),
      },
      {
        project: 'Webstability',
        channel: 'instagram',
        format: 'carousel',
        title: '5 redenen',
        hook: '5 redenen waarom je website geen klanten oplevert',
        text: '5 redenen waarom je website geen klanten oplevert 👇\n\nBewaar dit voor je volgende update.',
        hashtags: ['webdesign', 'ondernemen'],
        day: day(2),
        time: '19:30',
        slides: [{ title: '5 redenen waarom je website geen klanten oplevert' }, { title: 'Niemand snapt wat je doet', body: 'Zeg in de eerste zin wie je helpt.' }, { title: 'Geen volgende stap', body: 'Eén knop per pagina.' }, { title: 'Bewaar dit' }],
      },
      {
        project: 'Webstability',
        channel: 'tiktok',
        format: 'reel',
        title: 'Website-fout in 10 seconden',
        hook: 'Je website kost je klanten. Zo zie je waarom',
        text: 'Check je eigen site in 10 seconden #website',
        day: day(3),
        reel: { beats: [{ sec: 0, text: 'Je website kost je klanten', shot: 'Scroll door een trage site' }, { sec: 2, text: 'Check dit: is er één knop?' }, { sec: 5, text: 'Nee? Daar lekt het' }] },
      },
      {
        project: 'Webstability',
        channel: 'forum',
        format: 'answer',
        title: 'Vraag over trage WordPress-site',
        hook: 'Trage site',
        text: '',
        day: day(2),
        forum: { place: 'Higherlevel.nl', url: 'https://www.higherlevel.nl/forums/topic/12345-trage-website/', answer: 'Begin met je afbeeldingen: zet ze om naar WebP en laad ze lui…', disclosure: 'Disclaimer: ik onderhoud zelf websites (Webstability).' },
      },
    ],
  })
  expect(saved.isError).toBe(false)
  expect(saved.text).toContain('Opgeslagen: 4 items voor de contentweek (1 LinkedIn, 1 Instagram, 1 TikTok, 1 Forums)')
  expect(saved.text).toContain('one a day at most')

  // The cockpit draws the slides, the PDF and the cover in the background.
  await expect
    .poll(
      async () => {
        await page.reload()
        return page.locator('.slides-strip img').count()
      },
      { timeout: 30_000 },
    )
    .toBe(5 + 4 + 1)
  const carousel = page.locator('article').filter({ hasText: '5 redenen waarom je website geen klanten oplevert' })
  await expect(carousel.locator('img')).toHaveCount(4)
  await expect.poll(() => carousel.locator('img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 1080))).toBe(true)
  await expect(carousel).toContainText('19:30')
  const firstImage = await carousel.locator('img').first().getAttribute('src')
  const media = await page.request.get(firstImage!)
  expect(media.headers()['content-type']).toBe('image/png')
  const part = await page.request.get(firstImage!, { headers: { Range: 'bytes=0-99' } })
  expect(part.status()).toBe(206)
  expect((await part.body()).length).toBe(100)
  expect((await request.get(firstImage!)).status()).toBe(401)
  await shot(page, '28-content-week')

  // Vandaag points to it.
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Contentweek · \d+ klaar om goed te keuren/ })).toBeVisible()
  await page.goto('/content')

  // He fixes a slide; it is drawn again.
  await carousel.getByText('Aanpassen of opnieuw laten maken').click()
  await carousel.getByLabel('Dia 2: titel').fill('Niemand snapt binnen 5 seconden wat je doet')
  await carousel.getByRole('button', { name: 'Bewaren' }).click()
  await expect(carousel.getByRole('status').filter({ hasText: 'Bewaard en opnieuw getekend.' })).toBeVisible()

  // The whole week in one go; the LinkedIn document is now a PDF to download.
  await page.getByRole('button', { name: /Week goedkeuren \(\d+\)/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /\d+ goedgekeurd\./ })).toBeVisible()
  await page.reload()
  const doc = page.locator('article').filter({ hasText: 'Ik checkte 40 mkb-sites' })
  await expect(doc.getByText('Goedgekeurd')).toBeVisible()
  const pdfHref = await doc.getByRole('link', { name: 'PDF' }).getAttribute('href')
  const pdf = await page.request.get(pdfHref!)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  expect(pdf.headers()['content-disposition']).toContain('Checklist website.pdf')

  // A forum answer: he posts it himself and says so.
  const forum = page.locator('article').filter({ hasText: 'Higherlevel.nl' })
  await expect(forum.getByRole('link', { name: 'open de plek' })).toHaveAttribute('href', 'https://www.higherlevel.nl/forums/topic/12345-trage-website/')
  await expect(forum.getByRole('button', { name: 'Kopieer antwoord' })).toBeVisible()
  await forum.getByRole('button', { name: 'Geplaatst' }).click()
  await expect(forum.getByText('Geplaatst', { exact: true }).first()).toBeVisible()

  // Claude redoes the TikTok with his remark; the new version takes its place.
  const reel = page.locator('article').filter({ hasText: 'Je website kost je klanten. Zo zie je waarom' })
  await reel.getByText('Aanpassen of opnieuw laten maken').click()
  await reel.getByLabel('Wat moet er beter?').fill('pakkender, met een vraag')
  await reel.getByRole('button', { name: 'Opnieuw laten maken' }).click()
  await expect(reel.getByRole('status').filter({ hasText: 'Claude Code is geopend' })).toBeVisible()
  const redo = await mcpTool(request, 'get_task', { ticket: lastTicket() })
  expect(redo.text).toContain('His remark: pakkender, met een vraag')
  const id = redo.text.match(/"replaces": "([^"]+)"/)![1]
  const replaced = await mcpTool(request, 'save_content_week', {
    items: [{ project: 'Webstability', channel: 'tiktok', format: 'reel', title: 'Klant kwijt?', hook: 'Hoeveel klanten kost jouw website je?', text: 'Doe de check #website', day: day(3), replaces: id, reel: { beats: [{ sec: 0, text: 'Hoeveel klanten kost jouw site je?' }, { sec: 3, text: 'Check: één knop per pagina' }] } }],
  })
  expect(replaced.isError).toBe(false)
  await expect
    .poll(async () => {
      await page.reload()
      return (await page.locator('article').filter({ hasText: 'Hoeveel klanten kost jouw website je?' }).count()) + (await page.locator('article').filter({ hasText: 'Je website kost je klanten. Zo zie je waarom' }).count()) * 10
    })
    .toBe(1)
  await context.close()
})
