import { describe, expect, it } from 'vitest'
import { planImport, projectNameOf, type RepoForImport } from './import-plan'

const now = new Date('2026-10-04T12:00:00Z')
const repo = (fullName: string, over: Partial<RepoForImport> = {}): RepoForImport => ({
  fullName,
  description: '',
  homepage: null,
  pushedAt: '2026-10-01T10:00:00Z',
  archived: false,
  fork: false,
  ...over,
})

describe('projectNameOf', () => {
  it('names a project after the venture in the repository name', () => {
    expect(projectNameOf('laurensbs/caravanstallingspanje-repair')).toBe('Caravanstallingspanje')
    expect(projectNameOf('laurensbs/autorijschool-lissers')).toBe('Autorijschool lissers')
    expect(projectNameOf('laurensbs/scapestack-runelite-plugin')).toBe('Scapestack')
  })
})

describe('planImport', () => {
  it('turns new groups into projects, with details from GitHub', () => {
    const plan = planImport(
      [
        repo('laurensbs/caravanstallingspanje', { description: 'Caravans stallen in Spanje', homepage: 'https://caravanstallingspanje.nl' }),
        repo('laurensbs/caravanstallingspanje-repair'),
        repo('laurensbs/oldthing', { pushedAt: '2025-01-01T00:00:00Z' }),
      ],
      new Map(),
      now,
    )
    expect(plan.toExisting).toEqual([])
    expect(plan.newProjects).toEqual([
      { name: 'Caravanstallingspanje', names: ['laurensbs/caravanstallingspanje', 'laurensbs/caravanstallingspanje-repair'], oneLiner: 'Caravans stallen in Spanje', siteUrl: 'https://caravanstallingspanje.nl', stage: 'build' },
      { name: 'Oldthing', names: ['laurensbs/oldthing'], oneLiner: '', siteUrl: null, stage: 'maintain' },
    ])
  })

  it('leaves forks, archived and linked repositories alone, and adds relatives to their project', () => {
    const plan = planImport(
      [repo('laurensbs/rondje'), repo('laurensbs/rondje-admin'), repo('laurensbs/forked', { fork: true }), repo('laurensbs/old', { archived: true })],
      new Map([['laurensbs/rondje', 'p1']]),
      now,
    )
    expect(plan.toExisting).toEqual([{ projectId: 'p1', names: ['laurensbs/rondje-admin'] }])
    expect(plan.newProjects).toEqual([])
  })

  it('takes in repositories that are in the cockpit without a project', () => {
    const plan = planImport([repo('laurensbs/teampje')], new Map([['laurensbs/teampje', null]]), now)
    expect(plan.newProjects.map((p) => p.names)).toEqual([['laurensbs/teampje']])
  })
})
