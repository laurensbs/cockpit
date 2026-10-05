// The week in five numbers: what he did that brings customers closer, this week next to last week. Pure,
// so the counting can be tested; src/server/week-score.ts gathers the events from what the cockpit keeps.

export const MEASURES = ['called', 'info', 'answered', 'posted', 'helped'] as const
export type Measure = (typeof MEASURES)[number]

export const MEASURE_LABEL: Record<Measure, string> = {
  called: 'Gebeld',
  info: 'Info gevraagd',
  answered: 'Antwoord of gesprek',
  posted: 'Gepost',
  helped: 'Geholpen',
}

export interface ScoreEvent {
  measure: Measure
  projectId: string | null
  /** YYYY-MM-DD */
  day: string
}

type Counts = Record<Measure, number>
const zero = (): Counts => ({ called: 0, info: 0, answered: 0, posted: 0, helped: 0 })

export interface WeekScore {
  now: Counts
  before: Counts
  /** This week per project, the busiest first; projects with nothing this week are left out. */
  projects: { projectId: string; counts: Counts; total: number }[]
}

/** Counts this week (from Monday `weekStart`) and the week before it. */
export function weekScore(events: readonly ScoreEvent[], weekStart: string, lastWeekStart: string): WeekScore {
  const now = zero()
  const before = zero()
  const per = new Map<string, Counts>()
  for (const e of events) {
    if (e.day >= weekStart) {
      now[e.measure]++
      if (e.projectId) {
        const c = per.get(e.projectId) ?? zero()
        c[e.measure]++
        per.set(e.projectId, c)
      }
    } else if (e.day >= lastWeekStart) before[e.measure]++
  }
  const projects = [...per.entries()]
    .map(([projectId, counts]) => ({ projectId, counts, total: MEASURES.reduce((t, m) => t + counts[m], 0) }))
    .sort((a, b) => b.total - a.total)
  return { now, before, projects }
}

/** "3 gebeld · 1 gepost": a project's week in one short line, only what happened. */
export function projectLine(counts: Counts): string {
  return MEASURES.filter((m) => counts[m])
    .map((m) => `${counts[m]} ${MEASURE_LABEL[m].toLowerCase()}`)
    .join(' · ')
}

/** For Claude: what he did on this project this week, next to last week. */
export function weekLearning(score: WeekScore): string | null {
  const any = MEASURES.some((m) => score.now[m] || score.before[m])
  if (!any) return null
  const part = (m: Measure, label: string) => `${label} ${score.now[m]} (last week ${score.before[m]})`
  return `This week so far: ${[part('called', 'called'), part('info', 'asked for info'), part('answered', 'answered or met'), part('posted', 'posted'), part('helped', 'helped in a community')].join(', ')}. Build on what moves.`
}
