import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { METRIC_DEFS } from './metrics'
import { pace } from './pace'

const northStar = { key: 'mrr' as const, target: 3000, deadline: '2027-01-01', baseline: 1000, startedOn: '2026-07-01' }
const today = '2026-10-01'
// July 1 → Jan 1 is 184 days; Oct 1 is day 92, halfway: the line expects 2000.

describe('pace for a level (MRR)', () => {
  it('is on track when today matches the line', () => {
    const p = pace(northStar, METRIC_DEFS.mrr, new Map([['2026-09-30', 2000]]), today)
    expect(p.status).toBe('on_track')
    expect(p.expected).toBeCloseTo(2000, 0)
    expect(p.progress).toBeCloseTo(0.5)
  })
  it('is behind or far behind, ahead, or done', () => {
    expect(pace(northStar, METRIC_DEFS.mrr, new Map([['2026-09-30', 1700]]), today).status).toBe('behind')
    expect(pace(northStar, METRIC_DEFS.mrr, new Map([['2026-09-30', 1200]]), today).status).toBe('far_behind')
    expect(pace(northStar, METRIC_DEFS.mrr, new Map([['2026-09-30', 2400]]), today).status).toBe('ahead')
    expect(pace(northStar, METRIC_DEFS.mrr, new Map([['2026-09-30', 3100]]), today).status).toBe('done')
  })
  it('says what is needed per week and where the recent pace lands', () => {
    const p = pace(
      northStar,
      METRIC_DEFS.mrr,
      new Map([
        ['2026-09-03', 1600],
        ['2026-09-30', 2000],
      ]),
      today,
    )
    expect(p.recentPerWeek).toBe(100)
    expect(p.neededPerWeek).toBeCloseTo(1000 / (92 / 7), 1)
    expect(p.projected).toBeGreaterThan(3000)
  })
  it('has no data when the latest value is more than two weeks old, and is overdue after the deadline', () => {
    expect(pace(northStar, METRIC_DEFS.mrr, new Map([['2026-09-01', 2500]]), today).status).toBe('no_data')
    expect(pace(northStar, METRIC_DEFS.mrr, new Map([['2027-01-10', 2500]]), '2027-01-12').status).toBe('overdue')
  })
})

describe('pace for a flow (leads per 30 days)', () => {
  it('counts the last 30 days and reads the target as per 30 days', () => {
    const daily = new Map(Array.from({ length: 30 }, (_, i) => [addDays(today, -i), 1] as [string, number]))
    const p = pace({ key: 'leads', target: 60, deadline: '2027-01-01', baseline: 10, startedOn: '2026-07-01' }, METRIC_DEFS.leads, daily, today)
    expect(p.current).toBe(30)
    expect(p.recentPerWeek).toBe(7)
    expect(p.neededPerWeek).toBe(14)
    expect(p.status).toBe('behind')
  })
  it('works for a target that should go down (costs)', () => {
    const daily = new Map([['2026-09-30', 400]])
    const p = pace({ key: 'costs', target: 200, deadline: '2027-01-01', baseline: 600, startedOn: '2026-07-01' }, METRIC_DEFS.costs, daily, today)
    expect(p.status).toBe('on_track')
    expect(p.progress).toBeCloseTo(0.5)
  })
})
