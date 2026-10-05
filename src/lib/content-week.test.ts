import { describe, expect, it } from 'vitest'
import { defaultRhythm, LINKEDIN_WEEK_MAX, normalizeRhythm } from './ai/playbooks'
import type { ContentItemInput } from './ai/schemas'
import { brandIssues, contrast, hexColor, inkOn, normalizeBrand } from './brand'
import { normalizePiece, normalizeWeek, weekBody } from './content-week'

const today = '2026-10-05'
const base = (over: Partial<ContentItemInput>): ContentItemInput => ({
  project: 'Webstability',
  channel: 'instagram',
  format: 'carousel',
  title: '5 redenen',
  hook: '5 redenen waarom je website geen klanten oplevert',
  text: 'Lees mee 👇',
  day: '2026-10-07',
  slides: [{ title: 'Een' }, { title: 'Twee', body: 'Uitleg' }, { title: 'Drie 🚀' }],
  ...over,
})

describe('content week', () => {
  it('keeps a good carousel, strips emoji from slides but not from the caption, and sets a default time', () => {
    const r = normalizePiece(base({ hashtags: ['#webdesign', 'mkb', 'webdesign', 'a', 'b', 'c', 'd', 'e', 'f'] }), today)
    if ('error' in r) throw new Error(r.error)
    expect(r.ok.slides.map((s) => s.title)).toEqual(['Een', 'Twee', 'Drie'])
    expect(r.ok.text).toContain('👇')
    expect(r.ok.time).toBe('19:00')
    expect(r.ok.hashtags).toHaveLength(8)
    expect(r.ok.hashtags[0]).toBe('#webdesign')
  })
  it('refuses a format the channel does not take, a day outside the window, and thin carousels', () => {
    expect(normalizePiece(base({ channel: 'linkedin', format: 'carousel' }), today)).toEqual({ error: expect.stringContaining('linkedin takes') })
    expect(normalizePiece(base({ day: '2026-10-04' }), today)).toEqual({ error: expect.stringContaining('day must be') })
    expect(normalizePiece(base({ day: '2026-10-19' }), today)).toEqual({ error: expect.stringContaining('day must be') })
    expect(normalizePiece(base({ slides: [{ title: 'Een' }] }), today)).toEqual({ error: expect.stringContaining('3–10 slides') })
  })
  it('makes a reel from its beats, with a sane length and a cover text', () => {
    const r = normalizePiece(base({ channel: 'tiktok', format: 'reel', slides: undefined, reel: { beats: [{ sec: 4, text: 'Fix het zo' }, { sec: 0, text: 'Je site kost klanten' }] } }), today)
    if ('error' in r) throw new Error(r.error)
    expect(r.ok.reel?.beats.map((b) => b.sec)).toEqual([0, 4])
    expect(r.ok.reel?.durationSec).toBe(7)
    expect(r.ok.reel?.coverText).toBe('5 redenen waarom je website geen klanten oplevert')
    expect(normalizePiece(base({ channel: 'tiktok', format: 'reel', reel: { beats: [{ sec: 0, text: 'Eén' }] } }), today)).toEqual({ error: expect.stringContaining('two beats') })
  })
  it('needs a real place and link for a forum answer', () => {
    const ok = normalizePiece(base({ channel: 'forum', format: 'answer', text: '', forum: { place: 'r/webdev', url: 'https://reddit.com/r/webdev/comments/1', answer: 'Zo los je het op…' } }), today)
    expect('ok' in ok && ok.ok.forum?.url).toBe('https://reddit.com/r/webdev/comments/1')
    expect(normalizePiece(base({ channel: 'forum', format: 'answer', forum: { place: 'x', url: 'javascript:alert(1)', answer: 'a' } }), today)).toEqual({ error: expect.stringContaining('forum answer') })
  })
  it('keeps his LinkedIn humane: one a day and at most five a week, counting what is planned', () => {
    const li = (day: string) => base({ channel: 'linkedin', format: 'text', slides: undefined, day })
    const { ok, skipped } = normalizeWeek([li('2026-10-06'), li('2026-10-06'), li('2026-10-07')], today, ['2026-10-07'])
    expect(ok).toHaveLength(1)
    expect(skipped).toHaveLength(2)
    const many = normalizeWeek(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'].map(li), today)
    expect(many.ok).toHaveLength(LINKEDIN_WEEK_MAX)
  })
  it('stores a body every older list can still read', () => {
    const r = normalizePiece(base({}), today)
    if ('error' in r) throw new Error(r.error)
    const body = weekBody(r.ok)
    expect(body).toMatchObject({ week: true, format: 'Carrousel', caption: 'Lees mee 👇', bestTime: '19:00', render: { status: 'pending' } })
    expect(body.visualBrief).toBe('1. Een · 2. Twee · 3. Drie')
  })
})

describe('rhythm and house style', () => {
  it('has a rhythm per stage, within bounds', () => {
    expect(defaultRhythm('idea')).toEqual({ linkedin: 0, instagram: 0, tiktok: 0, forum: 0 })
    expect(normalizeRhythm({ instagram: 12, tiktok: -2, linkedin: '2' }, 'growth')).toEqual({ linkedin: 2, instagram: 7, tiktok: 0, forum: 2 })
  })
  it('reads colours, fonts and the handle, and warns when text would be unreadable', () => {
    expect(hexColor('#ABC')).toBe('#aabbcc')
    expect(hexColor('red')).toBeNull()
    const b = normalizeBrand({ accent: '#2f6bff', font: 'serif', style: 'x', handle: '@@web stability!' }, '#123456')
    expect(b).toMatchObject({ accent: '#2f6bff', font: 'serif', style: 'clean', handle: '@webstability' })
    expect(normalizeBrand(null, '#123456').accent).toBe('#123456')
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21)
    expect(inkOn('#ffd400')).toBe('#17161c')
    expect(inkOn('#1a1a2e')).toBe('#ffffff')
    expect(brandIssues({ ...b, fg: '#eeeeee', bg: '#ffffff' })).toHaveLength(1)
  })
})
