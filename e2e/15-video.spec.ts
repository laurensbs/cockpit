import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { addDays, dayOf } from '../src/lib/dates'
import { mcpTool, newVisitor, shot } from './helpers'

// Video: he adds a clip of his own to Rondje, Claude uses it in a reel, the cockpit makes the video
// (and a TikTok slideshow from a carousel); for a video he films himself he gets a CapCut folder and
// brings his export back. Needs ffmpeg on the machine that runs the tests.
const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0

test('reels from his own clips, a slideshow for TikTok, and the CapCut package', async ({ browser, request }) => {
  test.skip(!ffmpeg, 'ffmpeg is not installed here')
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-e2e-'))
  const clip = join(dir, 'park.mp4')
  expect(spawnSync('ffmpeg', ['-hide_banner', '-f', 'lavfi', '-i', 'testsrc=size=720x1280:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=3', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-y', clip]).status).toBe(0)

  const { context, page } = await newVisitor(browser)
  await page.goto('/content')
  const library = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Je media' }) })
  await library.getByLabel('Project').selectOption({ label: 'Rondje' })
  await library.getByLabel('Wat is er te zien?').fill('Ik loop met Bobbie door het park')
  await library.getByLabel('Clips of foto’s').setInputFiles(clip)
  await expect(library.getByRole('status')).toContainText('1 bestand toegevoegd.')
  await expect(library.getByRole('img', { name: 'Ik loop met Bobbie door het park' })).toBeVisible()
  await expect(library.getByText(/Clip · 3 s · staand/)).toBeVisible()
  // The upload is his, and only his.
  expect((await request.post('/api/media', { headers: { 'content-type': 'video/mp4', 'x-project': 'x' }, data: Buffer.from('nope') })).status()).toBe(401)

  // Claude sees the clip and uses it.
  const listed = await mcpTool(request, 'list_media', { project: 'Rondje' })
  const media = JSON.parse(listed.text) as { id: string; kind: string; shows: string; seconds: number; orientation: string }[]
  expect(media[0]).toMatchObject({ kind: 'clip', shows: 'Ik loop met Bobbie door het park', seconds: 3, orientation: 'portrait' })
  const today = dayOf(new Date())
  const saved = await mcpTool(request, 'save_content_week', {
    items: [
      {
        project: 'Rondje',
        channel: 'instagram',
        format: 'reel',
        title: 'Bobbie wil wandelen',
        hook: 'POV: je hond weet dat het zondag is',
        text: 'Zondag = wandeldag. Wie loopt er mee? #rondje',
        day: addDays(today, 2),
        reel: { durationSec: 5, beats: [{ sec: 0, text: 'POV: je hond weet dat het zondag is', shot: 'Bobbie bij de deur' }, { sec: 2, text: 'Loop mee met Rondje', shot: 'Wandelen in het park' }], mediaIds: [media[0].id], voiceover: '' },
      },
      {
        project: 'Rondje',
        channel: 'tiktok',
        format: 'carousel',
        title: '3 routes',
        hook: '3 hondenroutes in Utrecht',
        text: 'Bewaar dit voor zondag #utrecht #hond',
        day: addDays(today, 3),
        slides: [{ title: '3 hondenroutes in Utrecht' }, { title: 'Maximapark', body: 'Groot losloopgebied' }, { title: 'Amelisweerd', body: 'Bos en water' }],
      },
    ],
  })
  expect(saved.isError).toBe(false)

  // The cockpit makes both videos.
  const reel = page.locator('article').filter({ hasText: 'POV: je hond weet dat het zondag is' })
  const slideshow = page.locator('article').filter({ hasText: '3 hondenroutes in Utrecht' })
  await expect
    .poll(
      async () => {
        await page.reload()
        return (await reel.locator('video').count()) + (await slideshow.locator('video').count())
      },
      { timeout: 90_000, intervals: [2000] },
    )
    .toBe(2)
  const src = await reel.locator('video').getAttribute('src')
  const video = await page.request.get(src!)
  expect(video.headers()['content-type']).toBe('video/mp4')
  const file = join(dir, 'reel.mp4')
  writeFileSync(file, await video.body())
  const info = spawnSync('ffmpeg', ['-hide_banner', '-i', file]).stderr.toString()
  expect(info).toMatch(/Video: h264.*1080x1920/)
  expect(info).toMatch(/Audio: aac/)
  expect(info).toMatch(/Duration: 00:00:0[45]\./)
  // (Playing it is left to the app: Electron's Chromium decodes H.264, the test browser does not.)
  await shot(page, '29-video')

  // For a video he films himself: the CapCut folder, then his export comes back in.
  await reel.getByRole('button', { name: 'Maak CapCut-pakket' }).click()
  await expect(reel.getByRole('status')).toContainText('Klaar:')
  const opened = JSON.parse(readFileSync('test-results/claude-launch.txt', 'utf8').trim().split('\n').at(-1)!) as { open: string }
  expect(opened.open).toContain(join('test-results', 'capcut', 'Rondje'))
  const files = readdirSync(opened.open)
  for (const f of ['script.md', 'shots.md', 'captions.srt', 'LEESMIJ.md', 'cover.png', 'clip-1.mp4', 'tekstkaarten']) expect(files).toContain(f)
  expect(readdirSync(join(opened.open, 'tekstkaarten'))).toEqual(['01.png', '02.png'])
  expect(readFileSync(join(opened.open, 'captions.srt'), 'utf8')).toContain('00:00:00,000 --> 00:00:02,000\nPOV: je hond weet dat het zondag is')
  expect(readFileSync(join(opened.open, 'script.md'), 'utf8')).toContain('in beeld: Bobbie bij de deur')
  copyFileSync(file, join(opened.open, 'final.mp4'))
  await reel.getByRole('button', { name: 'Ik heb hem geëxporteerd' }).click()
  await expect(reel.getByRole('status')).toContainText('Je eigen versie staat erbij.')
  await page.reload()
  await expect(reel.getByText('Jouw versie uit CapCut')).toBeVisible()
  expect(existsSync(join(opened.open, 'final.mp4'))).toBe(true)
  await context.close()
})
