import { addDays, dayOf, daysBetween } from './dates'

export type CommitDays = Record<string, number>

/** Counts commits per Amsterdam day. */
export function commitDaysFrom(dates: readonly (string | Date)[]): CommitDays {
  const days: CommitDays = {}
  for (const d of dates) {
    const day = dayOf(typeof d === 'string' ? new Date(d) : d)
    days[day] = (days[day] ?? 0) + 1
  }
  return days
}

/** Adds up the commit days of several repositories (one project can have more than one). */
export function mergeCommitDays(list: readonly CommitDays[]): CommitDays {
  const out: CommitDays = {}
  for (const days of list) for (const [day, n] of Object.entries(days)) out[day] = (out[day] ?? 0) + n
  return out
}

/** Keeps only the days from `from` on, so stored history stays bounded. */
export function trimCommitDays(days: CommitDays, from: string): CommitDays {
  return Object.fromEntries(Object.entries(days).filter(([day]) => day >= from))
}

/** Commits per day for the n days up to and including `today`, oldest first. */
export function series(days: CommitDays, today: string, n: number): number[] {
  return Array.from({ length: n }, (_, i) => days[addDays(today, i - n + 1)] ?? 0)
}

/** Days with at least one commit in the n days up to and including today. */
export function activeDays(days: CommitDays, today: string, n: number): number {
  return series(days, today, n).filter((c) => c > 0).length
}

/** Whole days since the last commit day, or null without any. */
export function daysSinceLast(days: CommitDays, today: string): number | null {
  const last = Object.keys(days)
    .filter((d) => d <= today && days[d] > 0)
    .sort()
    .at(-1)
  return last ? daysBetween(last, today) : null
}

export type Trend = 'up' | 'down' | 'flat'

/** This week (the last 7 days) against the 7 days before, with some slack so 4 → 5 is not news. */
export function momentum(thisWeek: number, lastWeek: number): Trend {
  if (thisWeek === lastWeek) return 'flat'
  if (thisWeek > lastWeek && thisWeek - lastWeek >= Math.max(2, lastWeek * 0.25)) return 'up'
  if (thisWeek < lastWeek && lastWeek - thisWeek >= Math.max(2, lastWeek * 0.25)) return 'down'
  return 'flat'
}
