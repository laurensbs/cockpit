// Is a project on its way to its target? A straight line from where it started (baseline, on the day
// he accepted the model) to the target on the deadline; today's value is compared with that line. A
// level (MRR, members) uses its latest value; a flow (leads, visitors, revenue) its last 30 days, and
// then the target means "per 30 days". Pure, so it is testable.

import { addDays, daysBetween } from './dates'
import type { GrowthModel } from './growth-model'
import { lastOnOrBefore, type MetricDef, sumBetween } from './metrics'

export type PaceStatus = 'done' | 'ahead' | 'on_track' | 'behind' | 'far_behind' | 'overdue' | 'no_data'

export interface Pace {
  status: PaceStatus
  current: number | null
  expected: number | null
  target: number
  baseline: number | null
  /** 0–1 of the way from baseline to target. */
  progress: number
  weeksLeft: number
  /** Level: growth still needed per week. Flow: the weekly rate the target asks for. */
  neededPerWeek: number | null
  /** Level: growth per week over the last four weeks. Flow: the current weekly rate. */
  recentPerWeek: number | null
  /** Where it lands at the deadline at the recent pace (levels only). */
  projected: number | null
}

export const PACE_LABELS: Record<PaceStatus, string> = {
  done: 'Doel gehaald',
  ahead: 'Voor op schema',
  on_track: 'Op schema',
  behind: 'Achter op schema',
  far_behind: 'Ver achter',
  overdue: 'Deadline voorbij',
  no_data: 'Geen cijfers',
}

/** The value now: the latest level (no older than two weeks), or the flow over the last 30 days. */
export function currentValue(def: MetricDef, daily: Map<string, number>, today: string): number | null {
  if (def.agg === 'last') {
    const last = lastOnOrBefore(daily, today)
    return last && daysBetween(last.day, today) <= 14 ? last.value : null
  }
  return sumBetween(daily, addDays(today, -29), today)
}

/** The value on an earlier day, the same way. */
function valueOn(def: MetricDef, daily: Map<string, number>, day: string): number | null {
  if (def.agg === 'last') return lastOnOrBefore(daily, day)?.value ?? null
  return sumBetween(daily, addDays(day, -29), day)
}

export function pace(northStar: GrowthModel['northStar'], def: MetricDef, daily: Map<string, number>, today: string): Pace {
  const { target, deadline } = northStar
  const current = currentValue(def, daily, today)
  const startedOn = northStar.startedOn ?? today
  const baseline = northStar.baseline ?? valueOn(def, daily, startedOn) ?? current
  const totalDays = Math.max(1, daysBetween(startedOn, deadline))
  const elapsed = Math.min(Math.max(0, daysBetween(startedOn, today)), totalDays)
  const daysLeft = daysBetween(today, deadline)
  const weeksLeft = Math.max(0, Math.round((daysLeft / 7) * 10) / 10)
  const base = { target, baseline, weeksLeft, current }

  if (current == null || baseline == null) return { ...base, status: 'no_data', expected: null, progress: 0, neededPerWeek: null, recentPerWeek: null, projected: null }

  const span = target - baseline
  const direction = span >= 0 ? 1 : -1
  const expected = baseline + span * (elapsed / totalDays)
  const progress = span === 0 ? 1 : Math.min(1, Math.max(0, (current - baseline) / span))

  let neededPerWeek: number | null
  let recentPerWeek: number | null
  let projected: number | null = null
  if (def.agg === 'last') {
    neededPerWeek = daysLeft > 0 ? (target - current) / Math.max(daysLeft / 7, 1 / 7) : null
    const fourWeeksAgo = lastOnOrBefore(daily, addDays(today, -28))
    recentPerWeek = fourWeeksAgo ? (current - fourWeeksAgo.value) / 4 : null
    projected = recentPerWeek != null ? current + recentPerWeek * Math.max(0, daysLeft / 7) : null
  } else {
    neededPerWeek = (target * 7) / 30
    recentPerWeek = (current * 7) / 30
  }

  const reached = direction > 0 ? current >= target : current <= target
  let status: PaceStatus
  if (reached) status = 'done'
  else if (daysLeft < 0) status = 'overdue'
  else if (elapsed < 7 || span === 0) status = 'on_track'
  else {
    // How far ahead of or behind the line, as a share of the whole way.
    const lead = ((current - expected) * direction) / Math.abs(span)
    status = lead >= 0.1 ? 'ahead' : lead >= -0.05 ? 'on_track' : lead >= -0.25 ? 'behind' : 'far_behind'
  }
  return { ...base, status, expected, progress, neededPerWeek, recentPerWeek, projected }
}
