import { describe, expect, it } from 'vitest'
import {
  engagementOf,
  instagramInsights,
  keepOf,
  type MeasuredPost,
  median,
  normalizeStats,
  performanceLines,
  reachOf,
  statsLine,
  summarize,
  tiktokStats,
  tiktokVideoId,
} from './post-stats'

const post = (id: string, channel: string, format: string, stats: MeasuredPost['stats']): MeasuredPost => ({
  id,
  projectId: 'p1',
  channel,
  format,
  hook: `Hook ${id}`,
  day: '2026-09-20',
  time: '18:30',
  stats,
  permalink: null,
})

describe('post stats', () => {
  it('keeps whole, non-negative numbers of the known keys', () => {
    expect(normalizeStats({ views: 120.4, likes: -1, saves: '7', shares: 'x', other: 3, reach: 2e9 })).toEqual({ views: 120, saves: 7 })
    expect(normalizeStats(null)).toEqual({})
  })

  it('reads reach, engagement and what was kept', () => {
    const s = { views: 1000, likes: 30, comments: 5, shares: 5, saves: 10 }
    expect(reachOf(s)).toBe(1000)
    expect(reachOf({ reach: 400 })).toBe(400)
    expect(engagementOf(s)).toBeCloseTo(0.05)
    expect(keepOf(s)).toBeCloseTo(0.015)
    expect(engagementOf({ likes: 4 })).toBe(0)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })

  it('ranks per channel and per format, and says when it is too early', () => {
    const posts = [
      post('a', 'instagram', 'reel', { views: 4000, likes: 200, saves: 40 }),
      post('b', 'instagram', 'reel', { views: 2000, likes: 80 }),
      post('c', 'instagram', 'carousel', { views: 600, likes: 30, saves: 25 }),
      post('d', 'instagram', 'carousel', { views: 300, likes: 6 }),
      post('e', 'instagram', 'image', { views: 150, likes: 2 }),
      post('f', 'linkedin', 'text', { views: 900, likes: 20, comments: 6 }),
      post('g', 'tiktok', 'reel', {}),
    ]
    const [ig, li] = summarize(posts)
    expect(ig.channel).toBe('instagram')
    expect(ig.posts).toBe(5)
    expect(ig.early).toBe(false)
    expect(ig.medianReach).toBe(600)
    expect(ig.formats.map((f) => f.format)).toEqual(['reel', 'carousel', 'image'])
    expect(ig.formats[0]).toMatchObject({ posts: 2, medianReach: 3000 })
    expect(ig.best.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(ig.weakest.map((p) => p.id)).toEqual(['e', 'd'])
    expect(li).toMatchObject({ channel: 'linkedin', posts: 1, early: true, weakest: [] })
    // A post without numbers is not counted.
    expect(summarize(posts).some((r) => r.channel === 'tiktok')).toBe(false)
  })

  it('writes the lines for Claude, with followers', () => {
    const lines = performanceLines(summarize([post('a', 'instagram', 'reel', { views: 1240, likes: 50, saves: 12 }), post('b', 'instagram', 'carousel', { views: 300, likes: 9 })]), [
      { channel: 'instagram', now: 1204, change30: 56 },
      { channel: 'tiktok', now: 0, change30: null },
    ])
    expect(lines[0]).toBe('instagram: 2 measured posts, median 770 reached, median engagement 4% (fewer than 5: too early for conclusions, keep varying)')
    expect(lines[1]).toContain('reel 1× median 1,240 reached, 5% engagement, 1% saved or shared')
    expect(lines[2]).toBe('- best: "Hook a" (reel, 2026-09-20 18:30): 1,240 views, 5% engagement, 12 saved')
    expect(lines.at(-1)).toBe('Followers: instagram 1,204 (+56 in 30 days)')
    expect(performanceLines([], [])).toEqual([])
  })

  it('reads the platforms’ answers', () => {
    expect(
      instagramInsights({
        data: [
          { name: 'views', values: [{ value: 1240 }] },
          { name: 'saved', total_value: { value: 12 } },
          { name: 'total_interactions', values: [{ value: 99 }] },
        ],
      }),
    ).toEqual({ views: 1240, saves: 12 })
    expect(instagramInsights({ error: {} })).toEqual({})
    expect(tiktokStats({ view_count: 5000, like_count: 300, comment_count: 12, share_count: 40 })).toEqual({ views: 5000, likes: 300, comments: 12, shares: 40 })
    expect(tiktokVideoId('https://www.tiktok.com/@rondje.app/video/7380000000000000001?lang=nl')).toBe('7380000000000000001')
    expect(tiktokVideoId('https://evil.test/@x/video/7380000000000000001')).toBeNull()
    expect(tiktokVideoId('geen link')).toBeNull()
  })

  it('says it in Dutch on the cards', () => {
    expect(statsLine({ views: 1240, likes: 50, saves: 12 })).toBe('1.240 weergaven · 5% interactie · 50 likes · 12 bewaard')
    expect(statsLine({ reach: 300 })).toBe('300 bereikt · 0% interactie')
  })
})
