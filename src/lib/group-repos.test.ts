import { describe, expect, it } from 'vitest'
import { pickDocs } from './repo-docs'
import { stemOf, suggestGroups } from './group-repos'

describe('grouping repositories', () => {
  it('finds the venture in a name', () => {
    expect(stemOf('laurensbs/caravanstallingspanje-repair')).toBe('caravanstallingspanje')
    expect(stemOf('caravanstallingspanje-v1')).toBe('caravanstallingspanje')
    expect(stemOf('webstability-qr-menu')).toBe('webstability')
    expect(stemOf('scapestack-runelite-plugin')).toBe('scapestack')
  })

  it('groups names that belong together', () => {
    const groups = suggestGroups(['webstability', 'webstability-projecten', 'caravanstallingspanje', 'caravanstallingspanje-repair', 'teampje', 'scapestack', 'scapestack-runelite-plugin'])
    expect(groups).toContainEqual(['webstability', 'webstability-projecten'])
    expect(groups).toContainEqual(['caravanstallingspanje', 'caravanstallingspanje-repair'])
    expect(groups).toContainEqual(['scapestack', 'scapestack-runelite-plugin'])
    expect(groups).toContainEqual(['teampje'])
  })
})

describe('pickDocs', () => {
  it('puts marketing and strategy first and skips boilerplate', () => {
    expect(pickDocs(['docs/ITERATIONS.md', 'docs/MARKETING.md', 'docs/CHANGELOG.md', 'docs/STRATEGY.md', 'docs/logo.png', 'docs/GROWTH.md'], 3)).toEqual([
      'docs/MARKETING.md',
      'docs/STRATEGY.md',
      'docs/GROWTH.md',
    ])
  })
})
