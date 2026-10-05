import { describe, expect, it } from 'vitest'
import { lastRunProblem } from './claude-runs'

describe('lastRunProblem', () => {
  it('sees that the newest run failed because Claude Code is logged out', () => {
    const log = '--- run 2026-10-05T07:12:01Z posts\nFailed to authenticate: OAuth session expired and could not be refreshed\n'
    expect(lastRunProblem(log)).toBe('logged-out')
  })

  it('only looks at the newest run, and is quiet when nothing ran', () => {
    const log = '--- run 1 posts\nFailed to authenticate\n--- run 2 posts\nKlaar: 3 posts opgeslagen.\n'
    expect(lastRunProblem(log)).toBeNull()
    expect(lastRunProblem('')).toBeNull()
  })

  it('reads the login check of the daily round the same way, and forgets it once he logged in', () => {
    const out = '--- run 1 check\nNot logged in (claude auth status).\n'
    expect(lastRunProblem(out)).toBe('logged-out')
    expect(lastRunProblem(`${out}--- run 2 check\nLogged in.\n`)).toBeNull()
  })
})
