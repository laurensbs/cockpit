import { z } from 'zod'

// "Wire" schemas are what Claude must return. They are lenient on purpose: structured outputs
// only describe limits like enums and lengths to the model, they do not enforce them. The
// normalizers below clamp, map and trim, so whatever comes back becomes something the UI can show.

const str = z.string()

export const ProfileWire = z.object({
  oneLiner: str,
  positioning: str,
  audiences: z.array(z.object({ name: str, pains: str, whereToFind: str })),
  valueProps: z.array(str),
  channels: z.array(z.object({ name: str, why: str, effort: str, firstStep: str })),
  pillars: z.array(str),
  tone: str,
  kpis: z.array(z.object({ name: str, target: str })),
  risks: z.array(str),
  quickWins: z.array(str),
})

export const PlanWire = z.object({
  summary: str,
  phases: z.array(
    z.object({
      focus: str,
      actions: z.array(z.object({ title: str, why: str, channel: str, effort: str, week: z.number() })),
    }),
  ),
})

export type Effort = 'S' | 'M' | 'L'
export const EFFORT_LABELS: Record<Effort, string> = { S: 'klein', M: 'middel', L: 'groot' }
export const EFFORT_XP: Record<Effort, number> = { S: 10, M: 25, L: 50 }

export interface Profile {
  oneLiner: string
  positioning: string
  audiences: { name: string; pains: string; whereToFind: string }[]
  valueProps: string[]
  channels: { name: string; why: string; effort: Effort; firstStep: string }[]
  pillars: string[]
  tone: string
  kpis: { name: string; target: string }[]
  risks: string[]
  quickWins: string[]
}

export interface PlanAction {
  id: string
  title: string
  why: string
  channel: string
  effort: Effort
  week: number
  xp: number
}

export interface Plan {
  summary: string
  phases: { label: '30' | '60' | '90'; focus: string; actions: PlanAction[] }[]
}

// ---------- normalizing ----------

/** Trims, collapses runs of blank lines and cuts at a word near the limit. */
export function clean(text: string, max: number): string {
  const t = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (t.length <= max) return t
  const cut = t.lastIndexOf(' ', max - 1)
  return `${t.slice(0, cut > max * 0.7 ? cut : max - 1).trimEnd()}…`
}

const list = (items: string[], maxItems: number, maxLength: number) =>
  items
    .map((s) => clean(s, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)

/** "low", "laag", "klein", "S" … → S; "high", "hoog", "groot" … → L; everything else → M. */
export function effortOf(value: string): Effort {
  const v = value.trim().toLowerCase()
  if (/^(s|small|low|laag|klein|weinig|easy|makkelijk)/.test(v)) return 'S'
  if (/^(l|large|high|hoog|groot|veel|hard|zwaar)/.test(v)) return 'L'
  return 'M'
}

export function normalizeProfile(wire: z.infer<typeof ProfileWire>): Profile {
  return {
    oneLiner: clean(wire.oneLiner, 200),
    positioning: clean(wire.positioning, 800),
    audiences: wire.audiences.slice(0, 4).map((a) => ({ name: clean(a.name, 80), pains: clean(a.pains, 400), whereToFind: clean(a.whereToFind, 400) })),
    valueProps: list(wire.valueProps, 5, 200),
    channels: wire.channels.slice(0, 6).map((c) => ({ name: clean(c.name, 60), why: clean(c.why, 400), effort: effortOf(c.effort), firstStep: clean(c.firstStep, 300) })),
    pillars: list(wire.pillars, 4, 160),
    tone: clean(wire.tone, 400),
    kpis: wire.kpis.slice(0, 4).map((k) => ({ name: clean(k.name, 80), target: clean(k.target, 160) })),
    risks: list(wire.risks, 4, 400),
    quickWins: list(wire.quickWins, 5, 240),
  }
}

const PHASE_LABELS = ['30', '60', '90'] as const
const PHASE_WEEKS: Record<(typeof PHASE_LABELS)[number], [number, number]> = { '30': [1, 4], '60': [5, 9], '90': [10, 13] }

export function normalizePlan(wire: z.infer<typeof PlanWire>): Plan {
  return {
    summary: clean(wire.summary, 800),
    phases: wire.phases.slice(0, 3).map((phase, p) => {
      const label = PHASE_LABELS[p]
      const [from, to] = PHASE_WEEKS[label]
      return {
        label,
        focus: clean(phase.focus, 300),
        actions: phase.actions.slice(0, 6).map((a, i) => {
          const effort = effortOf(a.effort)
          const week = Number.isFinite(a.week) ? Math.min(to, Math.max(from, Math.round(a.week))) : from
          return { id: `${label}-${i + 1}`, title: clean(a.title, 120), why: clean(a.why, 400), channel: clean(a.channel, 60), effort, week, xp: EFFORT_XP[effort] }
        }),
      }
    }),
  }
}

/** Reads a stored brief back; anything that does not fit is treated as missing. */
export const profileFromJson = (value: unknown): Profile | null => {
  const r = ProfileWire.safeParse(value)
  return r.success ? normalizeProfile(r.data) : null
}
export function planFromJson(value: unknown): Plan | null {
  const r = z
    .object({
      summary: str,
      phases: z.array(
        z.object({
          label: z.enum(PHASE_LABELS),
          focus: str,
          actions: z.array(z.object({ id: str, title: str, why: str, channel: str, effort: z.enum(['S', 'M', 'L']), week: z.number(), xp: z.number() })),
        }),
      ),
    })
    .safeParse(value)
  return r.success ? r.data : null
}

// ---------- studio ----------

export const EmailsWire = z.object({ drafts: z.array(z.object({ title: str, subject: str, body: str, ps: str })) })
export const PostsWire = z.object({
  posts: z.array(z.object({ title: str, format: str, hook: str, caption: str, hashtags: z.array(str), visualBrief: str, bestTime: str })),
})
export const IdeasWire = z.object({
  ideas: z.array(z.object({ title: str, category: str, why: str, firstStep: str, impact: z.number(), effort: z.number(), cost: str, wildness: z.number() })),
})
export const OpportunitiesWire = z.object({ opportunities: z.array(z.object({ name: str, type: str, url: str, why: str, howToApproach: str })) })

export interface EmailDraft {
  title: string
  subject: string
  body: string
  ps: string
}
export interface PostDraft {
  title: string
  format: string
  hook: string
  caption: string
  hashtags: string[]
  visualBrief: string
  bestTime: string
}
export interface Idea {
  title: string
  category: string
  why: string
  firstStep: string
  impact: number
  effort: number
  cost: string
  wildness: number
}
export interface Opportunity {
  name: string
  type: string
  url: string | null
  why: string
  howToApproach: string
}

const score = (n: number) => (Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 3)

export const normalizeEmails = (w: z.infer<typeof EmailsWire>): EmailDraft[] =>
  w.drafts.slice(0, 5).map((d) => ({ title: clean(d.title, 100), subject: clean(d.subject, 140), body: clean(d.body, 4000), ps: clean(d.ps, 300) }))

/** "#Dogs", "dogs", "#dog walking" → "#Dogs", "#dogs", "#dogwalking"; at most 15, no doubles. */
export function hashtags(tags: string[]): string[] {
  const out: string[] = []
  for (const t of tags) {
    const tag = t.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')
    if (tag && !out.some((o) => o.toLowerCase() === `#${tag}`.toLowerCase())) out.push(`#${tag}`)
  }
  return out.slice(0, 15)
}

export const normalizePosts = (w: z.infer<typeof PostsWire>): PostDraft[] =>
  w.posts.slice(0, 7).map((p) => ({
    title: clean(p.title, 100),
    format: clean(p.format, 60),
    hook: clean(p.hook, 200),
    caption: clean(p.caption, 2200),
    hashtags: hashtags(p.hashtags),
    visualBrief: clean(p.visualBrief, 600),
    bestTime: clean(p.bestTime, 80),
  }))

export const normalizeIdeas = (w: z.infer<typeof IdeasWire>): Idea[] =>
  w.ideas.slice(0, 8).map((i) => ({
    title: clean(i.title, 120),
    category: clean(i.category, 40),
    why: clean(i.why, 500),
    firstStep: clean(i.firstStep, 300),
    impact: score(i.impact),
    effort: score(i.effort),
    cost: clean(i.cost, 60),
    wildness: score(i.wildness),
  }))

/** Only http(s) links survive: an answer cannot smuggle in a javascript: or mailto: link. */
export function safeLink(url: string): string | null {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export const normalizeOpportunities = (w: z.infer<typeof OpportunitiesWire>): Opportunity[] =>
  w.opportunities.slice(0, 10).map((o) => ({ name: clean(o.name, 120), type: clean(o.type, 40), url: safeLink(o.url), why: clean(o.why, 500), howToApproach: clean(o.howToApproach, 500) }))

// ---------- weekly ----------

export const WeeklyWire = z.object({
  headline: str,
  focus: z.array(z.object({ project: str, why: str, firstStep: str })),
  wins: z.array(str),
  avoiding: str,
  boss: z.object({ title: str, project: str, why: str }),
})

export interface Weekly {
  headline: string
  focus: { project: string; why: string; firstStep: string }[]
  wins: string[]
  avoiding: string
  boss: { title: string; project: string; why: string }
}

export const normalizeWeekly = (w: z.infer<typeof WeeklyWire>): Weekly => ({
  headline: clean(w.headline, 200),
  focus: w.focus.slice(0, 3).map((f) => ({ project: clean(f.project, 80), why: clean(f.why, 400), firstStep: clean(f.firstStep, 300) })),
  wins: list(w.wins, 3, 200),
  avoiding: clean(w.avoiding, 300),
  boss: { title: clean(w.boss.title, 120), project: clean(w.boss.project, 80), why: clean(w.boss.why, 300) },
})

export const weeklyFromJson = (value: unknown): Weekly | null => {
  const r = WeeklyWire.safeParse(value)
  return r.success ? normalizeWeekly(r.data) : null
}
