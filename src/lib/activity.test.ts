import { describe, expect, it } from 'vitest'
import { activeDays, commitDaysFrom, daysSinceLast, mergeCommitDays, momentum, series, trimCommitDays } from './activity'

describe('commit activity', () => {
  it('counts commits per Amsterdam day', () => {
    expect(commitDaysFrom(['2026-10-02T10:00:00Z', '2026-10-02T21:59:00Z', '2026-10-02T22:30:00Z'])).toEqual({
      '2026-10-02': 2,
      '2026-10-03': 1,
    })
  })

  it('merges and trims', () => {
    const merged = mergeCommitDays([{ '2026-10-01': 1 }, { '2026-10-01': 2, '2026-07-01': 5 }])
    expect(merged).toEqual({ '2026-10-01': 3, '2026-07-01': 5 })
    expect(trimCommitDays(merged, '2026-09-01')).toEqual({ '2026-10-01': 3 })
  })

  it('builds a series and counts active days', () => {
    const days = { '2026-10-01': 2, '2026-10-03': 1 }
    expect(series(days, '2026-10-03', 4)).toEqual([0, 2, 0, 1])
    expect(activeDays(days, '2026-10-03', 7)).toBe(2)
  })

  it('knows how long a project has been quiet', () => {
    expect(daysSinceLast({ '2026-09-20': 1 }, '2026-10-03')).toBe(13)
    expect(daysSinceLast({}, '2026-10-03')).toBeNull()
  })

  it('only calls a real change a trend', () => {
    expect(momentum(10, 4)).toBe('up')
    expect(momentum(4, 5)).toBe('flat')
    expect(momentum(1, 8)).toBe('down')
    expect(momentum(0, 0)).toBe('flat')
  })
})
