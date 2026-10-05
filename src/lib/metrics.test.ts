import { describe, expect, it } from 'vitest'
import { bucketWeeks, formatPct, lastWeeks, METRIC_DEFS, monthRollup, normalizePoints, resolveDaily, weeklyFlow } from './metrics'

describe('resolveDaily', () => {
  it('adds up payment providers for revenue', () => {
    const daily = resolveDaily(
      [
        { day: '2026-09-01', value: 100, source: 'stripe' },
        { day: '2026-09-01', value: 50, source: 'mollie' },
      ],
      METRIC_DEFS.revenue,
    )
    expect(daily.get('2026-09-01')).toBe(150)
  })
  it('prefers the more trusted source when sources must not add up', () => {
    const daily = resolveDaily(
      [
        { day: '2026-09-01', value: 40, source: 'ga4' },
        { day: '2026-09-01', value: 30, source: 'plausible' },
        { day: '2026-09-02', value: 5, source: 'pipeline' },
      ],
      METRIC_DEFS.visitors,
    )
    expect(daily.get('2026-09-01')).toBe(30)
    expect(daily.get('2026-09-02')).toBe(5)
  })
  it('counts won deals as MRR only where no payment source speaks that day', () => {
    const daily = resolveDaily(
      [
        { day: '2026-09-01', value: 300, source: 'pipeline' },
        { day: '2026-09-01', value: 280, source: 'stripe' },
        { day: '2026-09-02', value: 300, source: 'pipeline' },
      ],
      METRIC_DEFS.mrr,
    )
    expect(daily.get('2026-09-01')).toBe(280)
    expect(daily.get('2026-09-02')).toBe(300)
  })
  it('lets what he typed (or Claude recorded) replace the day', () => {
    const points = [
      { day: '2026-09-01', value: 100, source: 'stripe' },
      { day: '2026-09-01', value: 50, source: 'mollie' },
      { day: '2026-09-01', value: 120, source: 'claude' },
    ]
    expect(resolveDaily(points, METRIC_DEFS.revenue).get('2026-09-01')).toBe(120)
    expect(resolveDaily([...points, { day: '2026-09-01', value: 99, source: 'manual' }], METRIC_DEFS.revenue).get('2026-09-01')).toBe(99)
  })
})

describe('weeks and months', () => {
  const weeks = lastWeeks('2026-10-07', 3)
  it('lists the last full weeks, oldest first', () => {
    expect(weeks).toEqual(['2026-09-14', '2026-09-21', '2026-09-28'])
  })
  it('sums a flow per week and takes the last value of a level', () => {
    const daily = new Map([
      ['2026-09-15', 3],
      ['2026-09-20', 2],
      ['2026-09-29', 4],
    ])
    expect(bucketWeeks(daily, METRIC_DEFS.leads, weeks)).toEqual([5, null, 4])
    const mrr = new Map([
      ['2026-09-14', 100],
      ['2026-09-19', 120],
      ['2026-10-01', 150],
    ])
    expect(bucketWeeks(mrr, METRIC_DEFS.mrr, weeks)).toEqual([120, null, 150])
  })
  it('counts how much a level grew in a week, for the funnel', () => {
    const customers = new Map([
      ['2026-09-13', 10],
      ['2026-09-20', 12],
      ['2026-09-27', 12],
      ['2026-10-04', 15],
    ])
    expect(weeklyFlow(customers, METRIC_DEFS.customers, weeks)).toEqual([2, 0, 3])
  })
  it('rolls days up into months', () => {
    const daily = new Map([
      ['2026-08-31', 10],
      ['2026-09-01', 5],
      ['2026-09-30', 7],
    ])
    expect([...monthRollup(daily, METRIC_DEFS.revenue)]).toEqual([
      ['2026-08-01', 10],
      ['2026-09-01', 12],
    ])
    expect(monthRollup(daily, METRIC_DEFS.mrr).get('2026-09-01')).toBe(7)
  })
})

describe('normalizePoints', () => {
  it('keeps only numbers that can be true', () => {
    const { ok, rejected } = normalizePoints(
      [
        { key: 'leads', day: '2026-10-01', value: 3 },
        { key: 'leads', day: '2026-10-09', value: 3 },
        { key: 'nope', day: '2026-10-01', value: 3 },
        { key: 'leads', day: '2024-01-01', value: 3 },
        { key: 'leads', day: '2026-10-01', value: Number.NaN },
        { key: 'leads', day: '2026-13-45', value: 1 },
      ],
      '2026-10-04',
    )
    expect(ok).toHaveLength(1)
    expect(rejected.map((r) => r.why)).toEqual(['een dag in de toekomst', 'onbekend cijfer "nope"', 'meer dan 400 dagen geleden', 'geen geldig getal', 'geen geldige dag'])
  })
})

describe('formatPct', () => {
  it('writes conversions the Dutch way, with a decimal only where it matters', () => {
    expect(formatPct(0.0066)).toBe('0,7%')
    expect(formatPct(0.02)).toBe('2%')
    expect(formatPct(0.444)).toBe('44%')
  })
})
