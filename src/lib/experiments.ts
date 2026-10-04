// An experiment measured against the numbers: the value before it started (over the same number of
// days for a flow, the level just before for a level), the value during it, and a suggested verdict.
// The verdict is a suggestion: other things move numbers too, so he decides. Pure, so it is testable.

import { addDays, daysBetween } from './dates'
import { lastOnOrBefore, type MetricDef, sumBetween } from './metrics'

export const EXPERIMENT_DAYS = { min: 3, max: 42, default: 14 }

/** The number of days an experiment runs, within bounds. */
export function experimentDays(days: unknown): number {
  const n = typeof days === 'number' && Number.isFinite(days) ? Math.round(days) : EXPERIMENT_DAYS.default
  return Math.min(EXPERIMENT_DAYS.max, Math.max(EXPERIMENT_DAYS.min, n))
}

/** Before the start: a flow summed over as many days as the experiment runs, or a level just before. */
export function experimentBaseline(def: MetricDef, daily: Map<string, number>, startedOn: string, days: number): number | null {
  if (def.agg === 'sum') return sumBetween(daily, addDays(startedOn, -days), addDays(startedOn, -1))
  return lastOnOrBefore(daily, addDays(startedOn, -1))?.value ?? null
}

/** During the experiment, up to today or its end: a flow's total, or the level's latest value. */
export function experimentActual(def: MetricDef, daily: Map<string, number>, startedOn: string, endsOn: string, today: string): number | null {
  const end = today < endsOn ? today : endsOn
  if (end < startedOn) return null
  if (def.agg === 'sum') return sumBetween(daily, startedOn, end)
  const last = lastOnOrBefore(daily, end)
  return last && last.day >= startedOn ? last.value : null
}

export interface Verdict {
  lift: number | null
  suggestion: 'won' | 'lost' | null
}

/**
 * Did it work? With a target: reached or not. Without one: at least 10% better than before. No
 * suggestion when there is nothing to compare.
 */
export function experimentVerdict(input: { baseline: number | null; actual: number | null; targetValue: number | null }): Verdict {
  const { baseline, actual, targetValue } = input
  if (actual == null) return { lift: null, suggestion: null }
  const lift = baseline == null ? null : actual - baseline
  if (targetValue != null) return { lift, suggestion: actual >= targetValue ? 'won' : 'lost' }
  if (baseline == null) return { lift, suggestion: null }
  return { lift, suggestion: actual > baseline && actual >= baseline * 1.1 ? 'won' : 'lost' }
}

/** Days left until the end (0 on and after the last day). */
export function daysLeft(endsOn: string, today: string): number {
  return Math.max(0, daysBetween(today, endsOn))
}
