// What his yes and no taught: a few short lines for Claude's next search and next posts, so the
// proposals get better from what he chooses. Pure, so the summary can be tested; src/server/learning.ts
// gathers the rows.

export interface DecidedProspect {
  status: string
  city: string
  note: string
  basis: string
}

export interface PostDone {
  platform: string
  done: boolean
}

const count = <T extends string>(items: T[]) => [...items.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<T, number>())].sort((a, b) => b[1] - a[1])

/** "Nee: 3× te groot, 1× past niet · Ja per plaats: Palamós 3/3 …" */
export function learningLines(prospects: DecidedProspect[], posts: PostDone[], reach?: { last7: number; before7: number } | null): string[] {
  const lines: string[] = []
  const decided = prospects.filter((p) => p.status !== 'prospect')
  const no = decided.filter((p) => p.status === 'skipped')
  const reasons = count(no.map((p) => p.note.match(/Nee van Laurens: ([^·]+)$/)?.[1]?.trim() ?? 'anders'))
  if (reasons.length) lines.push(`He said no to ${no.length}: ${reasons.map(([r, n]) => `${n}× "${r}"`).join(', ')}. Look for fewer of these.`)
  const byCity = count(decided.filter((p) => p.city).map((p) => p.city))
  const cityLine = byCity
    .slice(0, 5)
    .map(([city, n]) => `${city} ${decided.filter((p) => p.city === city && p.status !== 'skipped').length}/${n}`)
    .join(', ')
  if (decided.length && cityLine) lines.push(`Yes per town (yes/decided): ${cityLine}. Search more where he says yes.`)
  const info = decided.filter((p) => p.basis === 'consent').length
  if (info) lines.push(`${info} business${info === 1 ? '' : 'es'} asked for information after his call: the approach works, keep the openings short and concrete.`)
  const done = posts.filter((p) => p.done)
  if (posts.length) {
    const per = count(done.map((p) => p.platform))
    lines.push(`Posts: he posted ${done.length} of the last ${posts.length} drafts${per.length ? ` (${per.map(([k, n]) => `${n} on ${k}`).join(', ')})` : ''}. Write for the platform he actually uses.`)
  }
  if (reach && (reach.last7 || reach.before7)) {
    const trend = reach.before7 ? Math.round(((reach.last7 - reach.before7) / reach.before7) * 100) : null
    lines.push(`Instagram reach: ${reach.last7} in the last 7 days${trend == null ? '' : ` (${trend >= 0 ? '+' : ''}${trend}% on the week before)`}.`)
  }
  return lines
}

/** One Dutch sentence for the end of the lesson, from what he decided in it. */
export function lessonLearned(yes: number, reasons: string[]): string | null {
  if (!yes && !reasons.length) return null
  const parts = [yes ? `${yes}× ja` : '', ...count(reasons).map(([r, n]) => `${n}× "${r}"`)].filter(Boolean)
  return `Claude onthoudt: ${parts.join(', ')}. Morgen zoekt hij daarop.`
}
