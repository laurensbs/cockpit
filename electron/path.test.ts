import { describe, expect, it } from 'vitest'
import { knownBinDirs, mergePath } from './path'

describe('mergePath', () => {
  it('puts the known folders first, then the shell, then what was there, without doubles', () => {
    const path = mergePath('/Users/laurens', '/opt/homebrew/bin:/Users/laurens/bin:/usr/bin', '/usr/bin:/bin')
    expect(path.split(':')).toEqual([
      '/Users/laurens/.local/bin',
      '/Users/laurens/.claude/local',
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/Users/laurens/.npm-global/bin',
      '/Users/laurens/bin',
      '/usr/bin',
      '/bin',
    ])
  })

  it('works without a shell PATH', () => {
    expect(mergePath('/Users/l', null, undefined)).toBe(knownBinDirs('/Users/l').join(':'))
  })
})
