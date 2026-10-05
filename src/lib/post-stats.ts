// What his posts did: the numbers per post (from Instagram and TikTok, or typed in for LinkedIn), and
// what they say per channel and format, so the next content week does more of what works. Pure, so the
// page, Claude's brief and the tests agree.

export const STAT_KEYS = ['views', 'reach', 'likes', 'comments', 'shares', 'saves'] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type PostStats = Partial<Record<StatKey, number>>

export const STAT_LABELS: Record<StatKey, string> = {
  views: 'weergaven',
  reach: 'bereik',
  likes: 'likes',
  comments: 'reacties',
  shares: 'gedeeld',
  saves: 'bewaard',
}

/** Below this many measured posts on a channel, a pattern is chance: keep varying. */
export const MIN_POSTS = 5
/** How far back the brief and the page look. */
export const RESULT_DAYS = 60
/** Posts older than this are no longer fetched: their numbers hardly move. */
export const MEASURE_DAYS = 30

/** Whole, non-negative numbers for the known keys; anything else is dropped. */
export function normalizeStats(raw: unknown): PostStats {
  const out: PostStats = {}
  if (!raw || typeof raw !== 'object') return out
  for (const key of STAT_KEYS) {
    const v = Number((raw as Record<string, unknown>)[key])
    if (Number.isFinite(v) && v >= 0 && v <= 1e9) out[key] = Math.round(v)
  }
  return out
}

export const hasStats = (s: PostStats | null | undefined) => Boolean(s && STAT_KEYS.some((k) => s[k] != null))

/** How many people saw it: views when the platform counts them, else reach. */
export const reachOf = (s: PostStats) => s.views ?? s.reach ?? 0
export const interactionsOf = (s: PostStats) => (s.likes ?? 0) + (s.comments ?? 0) + (s.shares ?? 0) + (s.saves ?? 0)
/** Share of the people who saw it that did something with it. */
export const engagementOf = (s: PostStats) => (reachOf(s) ? interactionsOf(s) / reachOf(s) : 0)
/** Share that kept or passed it on: the strongest sign of value. */
export const keepOf = (s: PostStats) => (reachOf(s) ? ((s.saves ?? 0) + (s.shares ?? 0)) / reachOf(s) : 0)

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface MeasuredPost {
  id: string
  projectId: string | null
  channel: string
  format: string
  hook: string
  /** Day and time it went out, in Amsterdam. */
  day: string
  time: string
  stats: PostStats
  permalink: string | null
}

export interface FormatResult {
  format: string
  posts: number
  medianReach: number
  engagement: number
  keep: number
}

export interface ChannelResult {
  channel: string
  posts: number
  medianReach: number
  engagement: number
  /** Too few posts to call anything a pattern. */
  early: boolean
  formats: FormatResult[]
  best: MeasuredPost[]
  weakest: MeasuredPost[]
}

/** Per channel: the middle, per format, the best three and (with enough posts) the weakest two. */
export function summarize(posts: MeasuredPost[]): ChannelResult[] {
  const measured = posts.filter((p) => hasStats(p.stats))
  const channels = [...new Set(measured.map((p) => p.channel))].sort()
  return channels.map((channel) => {
    const own = measured.filter((p) => p.channel === channel)
    const formats = [...new Set(own.map((p) => p.format))]
      .map((format) => {
        const list = own.filter((p) => p.format === format)
        return {
          format,
          posts: list.length,
          medianReach: median(list.map((p) => reachOf(p.stats))),
          engagement: median(list.map((p) => engagementOf(p.stats))),
          keep: median(list.map((p) => keepOf(p.stats))),
        }
      })
      .sort((a, b) => b.medianReach - a.medianReach || b.engagement - a.engagement)
    const ranked = [...own].sort((a, b) => reachOf(b.stats) - reachOf(a.stats) || engagementOf(b.stats) - engagementOf(a.stats))
    const best = ranked.slice(0, 3)
    const weakest = own.length >= 4 ? ranked.slice(-2).reverse().filter((p) => !best.includes(p)) : []
    return {
      channel,
      posts: own.length,
      medianReach: median(own.map((p) => reachOf(p.stats))),
      engagement: median(own.map((p) => engagementOf(p.stats))),
      early: own.length < MIN_POSTS,
      formats,
      best,
      weakest,
    }
  })
}

const pct = (n: number) => `${(Math.round(n * 1000) / 10).toString()}%`
const num = (n: number) => Math.round(n).toLocaleString('en-US')

/** One post in a line: its hook, format and moment, and what it did. */
export function postLine(p: MeasuredPost): string {
  const s = p.stats
  const parts = [`${num(reachOf(s))} ${s.views != null ? 'views' : 'reach'}`, `${pct(engagementOf(s))} engagement`]
  if (s.saves) parts.push(`${num(s.saves)} saved`)
  if (s.shares) parts.push(`${num(s.shares)} shared`)
  if (s.comments) parts.push(`${num(s.comments)} comments`)
  return `"${p.hook.replace(/\s+/g, ' ').slice(0, 120)}" (${p.format}, ${p.day} ${p.time}): ${parts.join(', ')}`
}

/** Followers per channel: the latest number and how it moved in 30 days. */
export interface FollowerLine {
  channel: string
  now: number
  change30: number | null
}

/** The measured results of one project, as lines for Claude's brief. Empty when nothing was measured. */
export function performanceLines(results: ChannelResult[], followers: FollowerLine[]): string[] {
  const lines: string[] = []
  for (const r of results) {
    lines.push(
      `${r.channel}: ${r.posts} measured post${r.posts === 1 ? '' : 's'}, median ${num(r.medianReach)} reached, median engagement ${pct(r.engagement)}${r.early ? ` (fewer than ${MIN_POSTS}: too early for conclusions, keep varying)` : ''}`,
    )
    if (r.formats.length > 1 || !r.early)
      lines.push(`- by format: ${r.formats.map((f) => `${f.format} ${f.posts}× median ${num(f.medianReach)} reached, ${pct(f.engagement)} engagement, ${pct(f.keep)} saved or shared`).join(' | ')}`)
    for (const p of r.best) lines.push(`- best: ${postLine(p)}`)
    for (const p of r.weakest) lines.push(`- weakest: ${postLine(p)}`)
  }
  const f = followers.filter((x) => x.now > 0)
  if (f.length) lines.push(`Followers: ${f.map((x) => `${x.channel} ${num(x.now)}${x.change30 != null ? ` (${x.change30 >= 0 ? '+' : ''}${num(x.change30)} in 30 days)` : ''}`).join(', ')}`)
  return lines
}

/** The video id in a TikTok link (tiktok.com/@name/video/123…), or null. */
export function tiktokVideoId(link: string): string | null {
  try {
    const url = new URL(link)
    if (!/(^|\.)tiktok\.com$/.test(url.hostname)) return null
    return url.pathname.match(/\/video\/(\d{6,30})/)?.[1] ?? null
  } catch {
    return null
  }
}

/** Instagram's insights answer ({data: [{name, values: [{value}]}]} or total_value) as stats. */
export function instagramInsights(raw: unknown): PostStats {
  const names: Record<string, StatKey> = { views: 'views', reach: 'reach', likes: 'likes', comments: 'comments', shares: 'shares', saved: 'saves' }
  const out: Record<string, number> = {}
  const data = (raw as { data?: unknown })?.data
  if (!Array.isArray(data)) return {}
  for (const m of data as { name?: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } }[]) {
    const key = m?.name ? names[m.name] : undefined
    if (!key) continue
    const value = m.total_value?.value ?? m.values?.[0]?.value
    if (typeof value === 'number') out[key] = value
  }
  return normalizeStats(out)
}

/** TikTok's video fields as stats. */
export const tiktokStats = (v: { view_count?: number; like_count?: number; comment_count?: number; share_count?: number }): PostStats =>
  normalizeStats({ views: v.view_count, likes: v.like_count, comments: v.comment_count, shares: v.share_count })

/** In a Dutch sentence for the cards: "1.240 weergaven · 4,1% interactie · 41 bewaard". */
export function statsLine(s: PostStats): string {
  const nl = (n: number) => Math.round(n).toLocaleString('nl-NL')
  const parts: string[] = []
  if (s.views != null) parts.push(`${nl(s.views)} weergaven`)
  else if (s.reach != null) parts.push(`${nl(s.reach)} bereikt`)
  if (reachOf(s)) parts.push(`${(Math.round(engagementOf(s) * 1000) / 10).toLocaleString('nl-NL')}% interactie`)
  for (const k of ['likes', 'comments', 'shares', 'saves'] as const) if (s[k]) parts.push(`${nl(s[k]!)} ${STAT_LABELS[k]}`)
  return parts.join(' · ')
}
