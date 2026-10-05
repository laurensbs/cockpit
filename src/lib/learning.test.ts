import { describe, expect, it } from 'vitest'
import { learningLines, learningSummary, lessonLearned } from './learning'

describe('learningLines', () => {
  it('sums up his no reasons, his yes per town, info asked after a call, posts and reach', () => {
    const lines = learningLines(
      [
        { status: 'skipped', city: 'Girona', note: 'Garage · Nee van Laurens: te groot', basis: 'business' },
        { status: 'skipped', city: 'Girona', note: 'Nee van Laurens: te groot', basis: 'business' },
        { status: 'new', city: 'Palamós', note: '', basis: 'business' },
        { status: 'drafted', city: 'Palamós', note: '', basis: 'consent' },
        { status: 'prospect', city: 'Blanes', note: '', basis: 'business' },
      ],
      [
        { platform: 'instagram', done: true },
        { platform: 'linkedin', done: false },
      ],
      { last7: 1200, before7: 1000 },
    )
    expect(lines[0]).toBe('He said no to 2: 2× "te groot". Look for fewer of these.')
    expect(lines[1]).toContain('Girona 0/2')
    expect(lines[1]).toContain('Palamós 2/2')
    expect(lines[2]).toContain('1 business asked for information')
    expect(lines[3]).toContain('he posted 1 of the last 2 drafts (1 on instagram)')
    expect(lines[4]).toBe('Instagram reach: 1200 in the last 7 days (+20% on the week before).')
  })

  it('says nothing when there is nothing to learn from yet', () => {
    expect(learningLines([{ status: 'prospect', city: 'Blanes', note: '', basis: 'business' }], [], null)).toEqual([])
  })
})

describe('lessonLearned', () => {
  it('turns the decisions of one lesson into one sentence', () => {
    expect(lessonLearned(2, ['te groot', 'te groot', 'past niet'])).toBe('Claude onthoudt: 2× ja, 2× "te groot", 1× "past niet". Morgen zoekt hij daarop.')
    expect(lessonLearned(0, [])).toBeNull()
  })
})

describe('learningSummary', () => {
  it('says in his words what his choices taught, at most three lines', () => {
    const lines = learningSummary(
      [
        { status: 'skipped', city: 'Begur', note: 'x · Nee van Laurens: te groot', basis: 'business' },
        { status: 'skipped', city: 'Begur', note: 'x · Nee van Laurens: te groot', basis: 'business' },
        { status: 'drafted', city: 'Palamós', note: '', basis: 'consent' },
        { status: 'prospect', city: 'Pals', note: '', basis: 'business' },
      ],
      [{ platform: 'instagram', done: true }],
    )
    expect(lines).toEqual(['Nee: 2× te groot. Claude zoekt minder van deze.', 'Ja per plaats: Begur 0 van 2, Palamós 1 van 1. Hij zoekt meer waar jij ja zegt.', '1 bedrijf vroeg om informatie na je telefoontje.'])
    expect(learningSummary([], [])).toEqual([])
  })
})
