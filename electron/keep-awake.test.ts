import { describe, expect, it } from 'vitest'
import { awakeStatus } from './keep-awake'

describe('keep awake', () => {
  it('only on mains power, and only when he wants it', () => {
    expect(awakeStatus(true, false)).toBe('awake')
    expect(awakeStatus(true, true)).toBe('battery')
    expect(awakeStatus(false, false)).toBe('off')
    expect(awakeStatus(false, true)).toBe('off')
  })
})
