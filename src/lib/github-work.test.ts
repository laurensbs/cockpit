import { describe, expect, it } from 'vitest'
import { areasOf, changeOf, workLines } from './github-work'

describe('github work', () => {
  it('names the areas a commit touched, biggest first', () => {
    const files = [
      { filename: 'app/portal/partners/page.tsx', additions: 120, deletions: 4 },
      { filename: 'lib/partners.ts', additions: 60, deletions: 0 },
      { filename: 'README.md', additions: 3, deletions: 1 },
    ]
    expect(areasOf(files)).toEqual(['app/portal', 'lib', 'README.md'])
    expect(changeOf({ sha: 'a1', date: '2026-10-05T09:00:00Z', message: 'Partneraccounts\n\nlang verhaal' }, files)).toMatchObject({ message: 'Partneraccounts', files: 3, additions: 183, deletions: 5 })
  })

  it('makes one line per pull request and change', () => {
    const lines = workLines(
      [{ number: 12, title: 'Partneraccounts', state: 'open', updatedAt: '2026-10-05T10:00:00Z' }],
      [{ date: '2026-10-05T09:00:00Z', message: 'Partneraccounts', areas: ['app/portal'], additions: 120, deletions: 4 }],
    )
    expect(lines).toEqual(['2026-10-05 PR #12 (open): Partneraccounts', '2026-10-05 Partneraccounts [app/portal; +120/−4]'])
  })
})
