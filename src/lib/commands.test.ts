import { describe, expect, it } from 'vitest'
import { buildCommands, matches } from './commands'

const projects = [
  { id: 'p1', name: 'Rondje' },
  { id: 'p2', name: 'Webstability' },
  { id: 'p3', name: 'OSRS RSPS' },
]

describe('matches', () => {
  it('needs every word, in any order, without caring about case or accents', () => {
    expect(matches('posts rondje', 'Maak posts voor Instagram', 'Rondje')).toBe(true)
    expect(matches('IDEEEN', 'Bedenk ideeën')).toBe(true)
    expect(matches('posts webstability', 'Maak posts voor Instagram', 'Rondje')).toBe(false)
    expect(matches('', 'anything')).toBe(true)
  })
})

describe('buildCommands', () => {
  it('without a query: the places, the projects, the weekly focus and the content week, no question', () => {
    const list = buildCommands('', projects, null)
    expect(list.some((c) => c.kind === 'ask')).toBe(false)
    expect(list.filter((c) => c.group === 'Ga naar').map((c) => c.label)).toContain('Vandaag')
    expect(list.filter((c) => c.group === 'Projecten')).toHaveLength(3)
    expect(list.filter((c) => c.group === 'Claude Code').map((c) => c.label)).toEqual(['Maak de focus van de week', 'Maak de contentweek'])
  })

  it('on a project page: the jobs for that project are there right away', () => {
    const jobs = buildCommands('', projects, projects[0]).filter((c) => c.kind === 'claude' && c.projectId === 'p1')
    expect(jobs.length).toBeGreaterThan(3)
    expect(jobs[0]).toMatchObject({ hint: 'Rondje' })
  })

  it('a real question matches nothing else, so asking Claude comes first: about the project he is on and about everything', () => {
    const list = buildCommands('hoe krijg ik meer bezoekers', projects, projects[1])
    expect(list[0]).toMatchObject({ kind: 'ask', projectId: 'p2', question: 'hoe krijg ik meer bezoekers', hint: 'over Webstability' })
    expect(list[1]).toMatchObject({ kind: 'ask', projectId: null, hint: 'over al je projecten' })
  })

  it('what matches comes before the question, which stays at the end', () => {
    const list = buildCommands('mailbox', projects, null)
    expect(list[0]).toMatchObject({ group: 'Ga naar', href: '/settings' })
    expect(list.at(-1)).toMatchObject({ kind: 'ask', question: 'mailbox' })
  })

  it('finds a job for any project by its words', () => {
    const list = buildCommands('posts osrs', projects, null)
    const job = list.find((c) => c.kind === 'claude')
    expect(job).toMatchObject({ kind: 'claude', task: 'posts', projectId: 'p3' })
    expect(list.find((c) => c.group === 'Projecten')).toBeUndefined()
  })

  it('finds places by their hint and projects by name', () => {
    expect(buildCommands('mailbox', projects, null).find((c) => c.group === 'Ga naar')).toMatchObject({ href: '/settings' })
    expect(buildCommands('ronDJE', projects, null).find((c) => c.group === 'Projecten')).toMatchObject({ href: '/projects/p1' })
  })

  it('keeps each group short', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, name: `Project ${i}` }))
    expect(buildCommands('project', many, null, 6).filter((c) => c.group === 'Projecten')).toHaveLength(6)
  })
})
