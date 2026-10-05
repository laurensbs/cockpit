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
  | (Base & { kind: 'call'; questId: string; phone: string | null; contactId: string | null; hasEmail: boolean })
  | (Base & { kind: 'prospects'; count: number })
  | (Base & { kind: 'reply'; contactId: string })
  | (Base & { kind: 'post'; itemId: string; platform: string; text: string; hook: string; profile: string | null; color: string; projectName: string })
  | (Base & { kind: 'checkin'; platform: 'instagram' })
  | (Base & { kind: 'build'; platform: string; note: string })
  | (Base & { kind: 'growth'; href: string; task: string | null; options?: Record<string, unknown> })

/** What comes first: what he promised today (calls), then decisions, then answers, then posting and growth. */
const ORDER: DayStep['kind'][] = ['call', 'prospects', 'reply', 'checkin', 'post', 'build', 'growth']
const MAX_OF_KIND: Record<DayStep['kind'], number> = { call: 2, prospects: 1, reply: 1, checkin: 1, post: 1, build: 1, growth: 1 }

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
