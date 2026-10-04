import { describe, expect, it } from 'vitest'
import { allowance, dailyCap, finalBody, inSendWindow, nextFollowupAt } from './outbox'

describe('finalBody', () => {
  it('adds an opt-out line in the right language when the text has none', () => {
    expect(finalBody('Hoi, zin in een rondje?', '', 'nl')).toBe('Hoi, zin in een rondje?\n\nLiever geen mail meer hierover? Laat het even weten, dan stop ik.')
    expect(finalBody('Hi there', '', 'en')).toContain('let me know and I will stop')
    expect(finalBody('Hola', '', 'xx')).toContain('Liever geen mail meer')
  })

  it('keeps the text as it is when it already has one, and adds the PS', () => {
    const body = 'Hoi!\n\nLiever geen mail meer hierover? Laat het weten.'
    expect(finalBody(body, 'P.S. Het is gratis.', 'nl')).toBe(`${body}\n\nPS Het is gratis.`)
    expect(finalBody('Dear team. Unsubscribe: reply stop.', '', 'en')).toBe('Dear team. Unsubscribe: reply stop.')
  })
})

describe('inSendWindow', () => {
  it('is open on weekdays from 9 to 17 in Amsterdam', () => {
    expect(inSendWindow(new Date('2026-10-05T07:30:00Z'))).toBe(true) // Monday 09:30 CEST
    expect(inSendWindow(new Date('2026-10-05T06:59:00Z'))).toBe(false) // Monday 08:59
    expect(inSendWindow(new Date('2026-10-05T15:00:00Z'))).toBe(false) // Monday 17:00
    expect(inSendWindow(new Date('2026-10-04T10:00:00Z'))).toBe(false) // Sunday
    expect(inSendWindow(new Date('2026-12-07T08:30:00Z'))).toBe(true) // Monday 09:30 CET
  })
})

describe('allowance', () => {
  const now = new Date('2026-10-05T10:00:00Z')
  it('sends one at a time, with a gap, within the cap', () => {
    expect(allowance({ sentToday: 0, cap: 20, lastSentAt: null, now })).toBe(1)
    expect(allowance({ sentToday: 3, cap: 20, lastSentAt: new Date(now.getTime() - 60_000), now })).toBe(0)
    expect(allowance({ sentToday: 3, cap: 20, lastSentAt: new Date(now.getTime() - 4 * 60_000), now })).toBe(1)
    expect(allowance({ sentToday: 20, cap: 20, lastSentAt: null, now })).toBe(0)
  })
  it('without a gap, sends up to the cap at once', () => {
    expect(allowance({ sentToday: 1, cap: 3, lastSentAt: now, now, gapMs: 0 })).toBe(2)
  })
})

describe('dailyCap and nextFollowupAt', () => {
  it('clamps the cap', () => {
    expect(dailyCap(null)).toBe(20)
    expect(dailyCap('5')).toBe(5)
    expect(dailyCap('500')).toBe(50)
    expect(dailyCap('0')).toBe(20)
    expect(dailyCap('abc')).toBe(20)
  })
  it('plans the follow-ups 4 and then 7 days later, and no more', () => {
    const sent = new Date('2026-10-05T10:00:00Z')
    expect(nextFollowupAt(0, sent)?.toISOString()).toBe('2026-10-09T10:00:00.000Z')
    expect(nextFollowupAt(1, sent)?.toISOString()).toBe('2026-10-12T10:00:00.000Z')
    expect(nextFollowupAt(2, sent)).toBeNull()
  })
})
