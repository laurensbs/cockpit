import { describe, expect, it } from 'vitest'
import { addDays, addMonths, dayLabel, dayOf, daysBetween, greeting, monthLabel, monthStart, weekStart, weekdayOf } from './dates'

describe('Amsterdam days', () => {
  it('uses the Amsterdam date, also around midnight UTC', () => {
    expect(dayOf(new Date('2026-10-03T22:30:00Z'))).toBe('2026-10-04') // 00:30 summer time
    expect(dayOf(new Date('2026-12-31T22:59:00Z'))).toBe('2026-12-31') // 23:59 winter time
  })

  it('does calendar arithmetic across months, years and DST changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(daysBetween('2026-10-01', '2026-10-25')).toBe(24)
    expect(daysBetween('2026-10-25', '2026-10-01')).toBe(-24)
  })

  it('finds the Monday of the week and the weekday', () => {
    expect(weekStart('2026-10-03')).toBe('2026-09-28') // a Saturday
    expect(weekStart('2026-09-28')).toBe('2026-09-28')
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // Sunday belongs to the same week
    expect(weekdayOf('2026-10-04')).toBe(7)
  })

  it('handles months', () => {
    expect(monthStart('2026-10-17')).toBe('2026-10-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(monthLabel('2026-10-01')).toBe('okt 2026')
    expect(dayLabel('2026-10-03')).toBe('za 3 okt')
  })

  it('greets by the Amsterdam hour', () => {
    expect(greeting(new Date('2026-10-03T06:00:00Z'))).toBe('Goedemorgen') // 08:00
    expect(greeting(new Date('2026-10-03T12:00:00Z'))).toBe('Goedemiddag') // 14:00
    expect(greeting(new Date('2026-10-03T19:00:00Z'))).toBe('Goedenavond') // 21:00
  })
})
