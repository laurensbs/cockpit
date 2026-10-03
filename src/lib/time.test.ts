import { describe, expect, it } from 'vitest'
import { ago, formatEuro, formatUsdMicros } from './time'

describe('ago', () => {
  const now = new Date('2026-10-03T12:00:00Z')
  it('says how long ago in plain Dutch', () => {
    expect(ago(new Date('2026-10-03T11:59:40Z'), now)).toBe('zojuist')
    expect(ago(new Date('2026-10-03T11:48:00Z'), now)).toBe('12 min geleden')
    expect(ago(new Date('2026-10-03T08:00:00Z'), now)).toBe('4 uur geleden')
    expect(ago(new Date('2026-10-02T08:00:00Z'), now)).toBe('gisteren')
    expect(ago(new Date('2026-09-29T08:00:00Z'), now)).toBe('4 dagen geleden')
    expect(ago(new Date('2026-08-01T08:00:00Z'), now)).toBe('za 1 aug')
  })
})

describe('money', () => {
  it('formats euros and AI costs', () => {
    expect(formatEuro(1234)).toMatch(/1\.234/)
    expect(formatUsdMicros(240_000)).toBe('$0.24')
  })
})
