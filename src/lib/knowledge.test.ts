import { describe, expect, it } from 'vitest'
import { knowledgeSig, parseStamp, refreshDue } from './knowledge'

const now = new Date('2026-10-05T12:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString()

describe('knowledgeSig', () => {
  it('follows the newest push and the STAND.md, and is empty when there is nothing to read', () => {
    const a = knowledgeSig([new Date('2026-10-05T09:26:00Z'), null], 1000)
    expect(knowledgeSig([new Date('2026-10-05T09:26:00Z')], 1000)).toBe(a)
    expect(knowledgeSig([new Date('2026-10-05T09:40:00Z')], 1000)).not.toBe(a)
    expect(knowledgeSig([null], null)).toBe('')
    expect(knowledgeSig([], 2000)).toBe('0|2000')
  })
})

describe('refreshDue', () => {
  it('reads a project once when it was never read, then again only after a push or a new STAND.md', () => {
    expect(refreshDue(null, 'a', now)).toBe(true)
    expect(refreshDue({ sig: 'a', at: hoursAgo(30) }, 'a', now)).toBe(false)
    expect(refreshDue({ sig: 'a', at: hoursAgo(4) }, 'b', now)).toBe(true)
  })

  it('waits three hours between reads, however often he pushes, and skips a project with nothing to read', () => {
    expect(refreshDue({ sig: 'a', at: hoursAgo(1) }, 'b', now)).toBe(false)
    expect(refreshDue(null, '', now)).toBe(false)
  })
})

describe('parseStamp', () => {
  it('reads what was stored and ignores anything else', () => {
    expect(parseStamp('{"sig":"a","at":"2026-10-05T10:00:00Z"}')).toEqual({ sig: 'a', at: '2026-10-05T10:00:00Z' })
    expect(parseStamp('kapot')).toBeNull()
    expect(parseStamp(null)).toBeNull()
  })
})
