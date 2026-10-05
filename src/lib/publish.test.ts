import { describe, expect, it } from 'vitest'
import { amsterdamTime, channelAllows, inWindow, littleText, nextTry } from './publish'

describe('publishing rules', () => {
  it('turns an Amsterdam day and time into the right moment, in summer and in winter', () => {
    expect(amsterdamTime('2026-07-01', '08:15').toISOString()).toBe('2026-07-01T06:15:00.000Z')
    expect(amsterdamTime('2026-12-01', '19:00').toISOString()).toBe('2026-12-01T18:00:00.000Z')
    expect(amsterdamTime('2026-10-25', '12:00').toISOString()).toBe('2026-10-25T11:00:00.000Z')
  })
  it('publishes only by day', () => {
    expect(inWindow(new Date('2026-10-06T05:30:00Z'))).toBe(true)
    expect(inWindow(new Date('2026-10-06T21:30:00Z'))).toBe(false)
  })
  it('keeps to a daily cap and a gap per channel', () => {
    const now = new Date('2026-10-06T12:00:00Z')
    expect(channelAllows('linkedin', [], now)).toEqual({ ok: true })
    expect(channelAllows('linkedin', [new Date('2026-10-06T08:00:00Z'), new Date('2026-10-06T09:00:00Z')], now)).toEqual({ ok: false, why: 'cap' })
    expect(channelAllows('instagram', [new Date('2026-10-06T11:50:00Z')], now)).toEqual({ ok: false, why: 'gap' })
  })
  it('tries twice more after a passing failure, never after a refusal', () => {
    const now = new Date('2026-10-06T12:00:00Z')
    expect(nextTry(1, now, true)?.toISOString()).toBe('2026-10-06T12:15:00.000Z')
    expect(nextTry(2, now, true)?.toISOString()).toBe('2026-10-06T13:00:00.000Z')
    expect(nextTry(3, now, true)).toBeNull()
    expect(nextTry(1, now, false)).toBeNull()
  })
  it('escapes what LinkedIn reads as markup', () => {
    expect(littleText('Prijs (incl. btw) @ 10% #mkb_tip #website')).toBe('Prijs \\(incl. btw\\) \\@ 10% {hashtag|\\#|mkb}\\_tip {hashtag|\\#|website}')
  })
})
