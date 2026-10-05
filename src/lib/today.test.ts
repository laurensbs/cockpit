import { describe, expect, it } from 'vitest'
import { buildNote, type DayStep, pickGivePlace, pickSteps, recentWork } from './today'

const call = (n: number): DayStep => ({ kind: 'call', key: `call-${n}`, title: `Bel ${n}`, sub: '', projectId: 'p', questId: `q${n}`, phone: null, contactId: null, hasEmail: false })
const growth: DayStep = { kind: 'growth', key: 'growth', title: 'Maak het groeimodel', sub: '', projectId: 'p', href: '/', task: 'model' }
const prospects: DayStep = { kind: 'prospects', key: 'prospects-p', title: '5 nieuwe bedrijven', sub: '', projectId: 'p', count: 5 }
const build: DayStep = { kind: 'build', key: 'build-p', title: 'Deel je bouwwerk', sub: '', projectId: 'p', platform: 'linkedin', note: '' }

describe('pickSteps', () => {
  it('puts promised calls first, then decisions, at most three, and at most two calls', () => {
    const steps = pickSteps([growth, build, prospects, call(1), call(2), call(3)])
    expect(steps.map((s) => s.key)).toEqual(['call-1', 'call-2', 'prospects-p'])
  })

  it('fills up with more of a kind when there is little else, and skips what he put off', () => {
    expect(pickSteps([call(1), call(2), call(3)]).map((s) => s.key)).toEqual(['call-1', 'call-2', 'call-3'])
    expect(pickSteps([growth, build, prospects], new Set(['prospects-p'])).map((s) => s.key)).toEqual(['build-p', 'growth'])
  })
})

describe('pickGivePlace', () => {
  const place = (id: string, type: string, rating = 0, url: string | null = `https://${id}.example`) => ({ id, type, url, rating })
  it('takes a place where people talk, the best rated first, and lets a place he just helped in rest', () => {
    const places = [place('press', 'media', 1), place('forum', 'forum'), place('group', 'facebook-group', 1), place('dir', 'directory', 1)]
    expect(pickGivePlace(places, new Set())?.id).toBe('group')
    expect(pickGivePlace(places, new Set(['group']))?.id).toBe('forum')
    expect(pickGivePlace(places, new Set(['group', 'forum']))).toBeNull()
  })

  it('skips a place without a link or with a thumbs down', () => {
    expect(pickGivePlace([place('a', 'subreddit', -1), place('b', 'discord', 0, null)], new Set())).toBeNull()
  })
})

describe('build in public', () => {
  it('keeps the commits of the last two days and leaves out merges and bumps', () => {
    const commits = [
      { date: '2026-10-04T21:00:00Z', message: 'Partneraccounts voor webdevelopers\n\nlong body' },
      { date: '2026-10-04T20:00:00Z', message: 'Merge pull request #20' },
      { date: '2026-09-20T10:00:00Z', message: 'Oud werk' },
    ]
    const work = recentWork(commits, '2026-10-05')
    expect(work).toHaveLength(2)
    expect(buildNote('Webstability', work)).toContain('Partneraccounts voor webdevelopers')
    expect(buildNote('Webstability', work)).not.toContain('Merge')
  })
})
