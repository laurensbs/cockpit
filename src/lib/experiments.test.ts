import { describe, expect, it } from 'vitest'
import { daysLeft, experimentActual, experimentBaseline, experimentDays, experimentVerdict } from './experiments'
import { METRIC_DEFS } from './metrics'

const daily = new Map([
  ['2026-09-10', 1],
  ['2026-09-15', 2],
  ['2026-09-20', 1],
  ['2026-09-24', 3],
  ['2026-09-28', 4],
  ['2026-10-02', 2],
])

describe('measuring an experiment', () => {
  it('compares a flow over the same number of days before and during', () => {
    // Started Sep 24 for 7 days: before = Sep 17–23 (1), during = Sep 24–30 (3 + 4).
    expect(experimentBaseline(METRIC_DEFS.leads, daily, '2026-09-24', 7)).toBe(1)
    expect(experimentActual(METRIC_DEFS.leads, daily, '2026-09-24', '2026-09-30', '2026-10-04')).toBe(7)
    // Still running: only up to today.
    expect(experimentActual(METRIC_DEFS.leads, daily, '2026-09-24', '2026-10-07', '2026-09-28')).toBe(7)
  })
  it('takes a level just before the start, and the latest value during it', () => {
    const mrr = new Map([
      ['2026-09-20', 800],
      ['2026-09-30', 900],
    ])
    expect(experimentBaseline(METRIC_DEFS.mrr, mrr, '2026-09-24', 14)).toBe(800)
    expect(experimentActual(METRIC_DEFS.mrr, mrr, '2026-09-24', '2026-10-07', '2026-10-04')).toBe(900)
    expect(experimentActual(METRIC_DEFS.mrr, new Map([['2026-09-20', 800]]), '2026-09-24', '2026-10-07', '2026-10-04')).toBeNull()
  })
  it('suggests a verdict: the target reached, or at least 10% better without one', () => {
    expect(experimentVerdict({ baseline: 2, actual: 7, targetValue: 10 })).toEqual({ lift: 5, suggestion: 'lost' })
    expect(experimentVerdict({ baseline: 2, actual: 12, targetValue: 10 })).toEqual({ lift: 10, suggestion: 'won' })
    expect(experimentVerdict({ baseline: 10, actual: 10.5, targetValue: null }).suggestion).toBe('lost')
    expect(experimentVerdict({ baseline: 10, actual: 12, targetValue: null }).suggestion).toBe('won')
    expect(experimentVerdict({ baseline: null, actual: 3, targetValue: null })).toEqual({ lift: null, suggestion: null })
    expect(experimentVerdict({ baseline: 3, actual: null, targetValue: 5 }).suggestion).toBeNull()
  })
  it('keeps the duration within 3 and 42 days, 14 by default', () => {
    expect(experimentDays(undefined)).toBe(14)
    expect(experimentDays(1)).toBe(3)
    expect(experimentDays(90)).toBe(42)
    expect(daysLeft('2026-10-07', '2026-10-04')).toBe(3)
    expect(daysLeft('2026-10-01', '2026-10-04')).toBe(0)
  })
})
