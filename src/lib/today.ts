// The day route on Vandaag: at most three small steps, the most useful first, little text. Pure, so the
// choice can be tested; src/server/today.ts gathers the candidates. Claude prepares, he does or decides.

export const DAY_GOAL = 3

interface Base {
  key: string
  title: string
  sub: string
  projectId: string | null
}

export type DayStep =
  | (Base & { kind: 'call'; questId: string; phone: string | null; contactId: string | null; hasEmail: boolean; draft: { id: string; subject: string; body: string; followups: number } | null })
  | (Base & { kind: 'prospects'; count: number })
  | (Base & { kind: 'reply'; contactId: string })
  | (Base & { kind: 'give'; itemId: string; url: string; how: string })
  | (Base & { kind: 'setup'; setupKey: string; status: 'todo' | 'unknown'; why: string; steps: string[]; cost: string | null })
  | (Base & { kind: 'post'; itemId: string; platform: string; text: string; hook: string; profile: string | null; color: string; projectName: string })
  | (Base & { kind: 'checkin'; platform: 'instagram' })
  | (Base & { kind: 'build'; platform: string; note: string })
  | (Base & { kind: 'growth'; href: string; task: string | null; options?: Record<string, unknown> })

/** What comes first: what he promised today (calls), then decisions, then answers, then posting and growth. */
const ORDER: DayStep['kind'][] = ['call', 'prospects', 'reply', 'setup', 'give', 'checkin', 'post', 'build', 'growth']
const MAX_OF_KIND: Record<DayStep['kind'], number> = { call: 2, prospects: 1, reply: 1, setup: 1, give: 1, checkin: 1, post: 1, build: 1, growth: 1 }

export function pickSteps(candidates: DayStep[], hidden: ReadonlySet<string> = new Set(), max = DAY_GOAL): DayStep[] {
  const out: DayStep[] = []
  for (const kind of ORDER) {
    const of = candidates.filter((c) => c.kind === kind && !hidden.has(c.key)).slice(0, MAX_OF_KIND[kind])
    for (const step of of) if (out.length < max) out.push(step)
  }
  // Fewer than three kinds to offer: fill up with more of the same, in the same order.
  for (const kind of ORDER) {
    for (const step of candidates.filter((c) => c.kind === kind && !hidden.has(c.key) && !out.includes(c))) if (out.length < max) out.push(step)
  }
  return out
}

/** "Build in public": the note Claude gets to turn yesterday's commits into one post. */
export function buildNote(project: string, messages: string[]): string {
  const work = messages
    .map((m) => m.split('\n')[0].replace(/\s+/g, ' ').trim())
    .filter((m) => m && !/^(merge|bump|chore|wip)\b/i.test(m))
    .slice(0, 6)
  return `Bouwen in het openbaar: één post over wat ik gisteren aan ${project} bouwde. Kies het ene ding dat een klant of gebruiker merkt, vertel het als een klein verhaal, geen changelog. Wat er gebeurde: ${work.join('; ')}`.slice(0, 300)
}

/** Commits of the last two days, from the repos' recent commits (dates are ISO strings). */
export function recentWork(commits: { date: string; message: string }[], today: string): string[] {
  const since = new Date(`${today}T00:00:00Z`).getTime() - 2 * 86_400_000
  return commits.filter((c) => new Date(c.date).getTime() >= since).map((c) => c.message)
}

/** Pull requests he worked on in the last two days, as lines for the build-in-public note. */
export function recentPulls(pulls: { title: string; state: string; updatedAt: string }[], today: string): string[] {
  const since = new Date(`${today}T00:00:00Z`).getTime() - 2 * 86_400_000
  return pulls.filter((p) => new Date(p.updatedAt).getTime() >= since).map((p) => `${p.state === 'merged' ? 'Live gezet' : 'Bezig met'}: ${p.title}`)
}

/** Places where people talk every day; "other" (a meetup, an app) only when there is none of those. */
const TALK = /community|forum|subreddit|discord|facebook|group|groep|slack|whatsapp|telegram/i
const talkRank = (type: string) => (TALK.test(type) ? 0 : /^other$/i.test(type.trim()) ? 1 : null)

/**
 * "Help iemand": the place for today's bit of value. Only a place where people talk (a directory or the
 * press is a one-off, not a daily habit), the best rated first; a place he helped in the last six days rests.
 */
export function pickGivePlace<T extends { id: string; type: string; url: string | null; rating: number }>(places: T[], recent: ReadonlySet<string>): T | null {
  const open = places.filter((p) => p.url && p.rating >= 0 && !recent.has(p.id) && talkRank(p.type) !== null)
  return [...open].sort((a, b) => talkRank(a.type)! - talkRank(b.type)! || b.rating - a.rating)[0] ?? null
}
