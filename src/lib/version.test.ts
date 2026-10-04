import { describe, expect, it } from 'vitest'
import { isNewer } from './version'

describe('isNewer', () => {
  it('compares major, minor and patch as numbers', () => {
    expect(isNewer('0.4.0', '0.3.0')).toBe(true)
    expect(isNewer('0.10.0', '0.9.9')).toBe(true)
    expect(isNewer('1.0.0', '0.99.99')).toBe(true)
    expect(isNewer('0.3.1', '0.3.0')).toBe(true)
  })
  it('is false for the same or an older version', () => {
    expect(isNewer('0.4.0', '0.4.0')).toBe(false)
    expect(isNewer('0.3.9', '0.4.0')).toBe(false)
    expect(isNewer('v0.4.0', '0.4.0')).toBe(false)
  })
})
