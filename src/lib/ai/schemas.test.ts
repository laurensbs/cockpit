import { describe, expect, it } from 'vitest'
import { planFixture, profileFixture } from './fixtures'
import { clean, effortOf, normalizePlan, normalizeProfile, planFromJson, PlanWire, profileFromJson, ProfileWire } from './schemas'

describe('wire schemas', () => {
  it('accept the fixtures, like they accept real answers', () => {
    expect(ProfileWire.safeParse(profileFixture('Rondje')).success).toBe(true)
    expect(PlanWire.safeParse(planFixture()).success).toBe(true)
  })
})

describe('normalizing', () => {
  it('maps effort words in both languages', () => {
    expect(['low', 'Laag', 'klein', 'S'].map(effortOf)).toEqual(['S', 'S', 'S', 'S'])
    expect(['high', 'hoog', 'Groot', 'L'].map(effortOf)).toEqual(['L', 'L', 'L', 'L'])
    expect(['medium', 'gemiddeld', '?', 'M'].map(effortOf)).toEqual(['M', 'M', 'M', 'M'])
  })

  it('cuts long text at a word', () => {
    expect(clean('  een   korte zin  ', 50)).toBe('een   korte zin')
    expect(clean('aaaa bbbb cccc dddd', 12)).toBe('aaaa bbbb…')
  })

  it('caps lists and maps effort in a profile', () => {
    const wire = profileFixture('X')
    const many = { ...wire, valueProps: Array.from({ length: 9 }, (_, i) => `belofte ${i}`), channels: [...wire.channels, ...wire.channels, ...wire.channels, ...wire.channels] }
    const p = normalizeProfile(many)
    expect(p.valueProps).toHaveLength(5)
    expect(p.channels).toHaveLength(6)
    expect(p.channels[0].effort).toBe('M')
    expect(p.channels[1].effort).toBe('S')
  })

  it('labels the phases, keeps weeks inside them and gives XP by effort', () => {
    const plan = normalizePlan({
      summary: 's',
      phases: [
        { focus: 'a', actions: [{ title: 't', why: 'w', channel: 'c', effort: 'high', week: 9 }] },
        { focus: 'b', actions: [{ title: 't', why: 'w', channel: 'c', effort: 'low', week: 1 }] },
        { focus: 'c', actions: [{ title: 't', why: 'w', channel: 'c', effort: 'medium', week: Number.NaN }] },
        { focus: 'extra', actions: [] },
      ],
    })
    expect(plan.phases.map((p) => p.label)).toEqual(['30', '60', '90'])
    expect(plan.phases[0].actions[0]).toMatchObject({ id: '30-1', week: 4, effort: 'L', xp: 50 })
    expect(plan.phases[1].actions[0]).toMatchObject({ week: 5, effort: 'S', xp: 10 })
    expect(plan.phases[2].actions[0]).toMatchObject({ week: 10, xp: 25 })
  })

  it('reads stored briefs back, and refuses what does not fit', () => {
    const profile = normalizeProfile(profileFixture('Rondje'))
    expect(profileFromJson(JSON.parse(JSON.stringify(profile)))).toEqual(profile)
    const plan = normalizePlan(planFixture())
    expect(planFromJson(JSON.parse(JSON.stringify(plan)))).toEqual(plan)
    expect(planFromJson({ nope: true })).toBeNull()
  })
})

import { emailsFixture, ideasFixture, opportunitiesFixture, postsFixture } from './fixtures'
import { EmailsWire, hashtags, IdeasWire, normalizeIdeas, normalizeOpportunities, normalizePosts, OpportunitiesWire, PostsWire, safeLink } from './schemas'

describe('studio schemas', () => {
  it('accept the fixtures', () => {
    expect(EmailsWire.safeParse(emailsFixture()).success).toBe(true)
    expect(PostsWire.safeParse(postsFixture()).success).toBe(true)
    expect(IdeasWire.safeParse(ideasFixture()).success).toBe(true)
    expect(OpportunitiesWire.safeParse(opportunitiesFixture()).success).toBe(true)
  })

  it('tidies hashtags', () => {
    expect(hashtags(['#Rondje', 'rondje', 'dog walking', '##utrecht', ''])).toEqual(['#Rondje', '#dogwalking', '#utrecht'])
    expect(normalizePosts(postsFixture()).at(0)?.hashtags).toEqual(['#rondje', '#hondenliefde', '#Utrecht'])
  })

  it('keeps the planned day of a post only when it is a real date', () => {
    const [good, bad] = normalizePosts({ posts: [{ ...postsFixture().posts[0], plannedFor: '2026-10-07' }, { ...postsFixture().posts[0], plannedFor: 'woensdag' }] })
    expect(good.plannedFor).toBe('2026-10-07')
    expect(bad.plannedFor).toBeNull()
  })

  it('keeps scores between 1 and 5', () => {
    const [idea] = normalizeIdeas({ ideas: [{ ...ideasFixture().ideas[0], impact: 9, effort: -2, wildness: Number.NaN }] })
    expect(idea).toMatchObject({ impact: 5, effort: 1, wildness: 3 })
  })

  it('only lets web links through', () => {
    expect(safeLink('https://example.org/x')).toBe('https://example.org/x')
    expect(safeLink('javascript:alert(1)')).toBeNull()
    expect(safeLink('mailto:a@b.nl')).toBeNull()
    expect(normalizeOpportunities(opportunitiesFixture()).map((o) => o.url)).toEqual(['https://example.org/opvang', null])
  })
})

import { weeklyFixture } from './fixtures'
import { normalizeWeekly, WeeklyWire } from './schemas'

describe('weekly schema', () => {
  it('accepts the fixture and caps the focus at three', () => {
    expect(WeeklyWire.safeParse(weeklyFixture()).success).toBe(true)
    const many = { ...weeklyFixture(), focus: Array.from({ length: 5 }, (_, i) => ({ project: `P${i}`, why: 'w', firstStep: 's' })) }
    expect(normalizeWeekly(many).focus).toHaveLength(3)
  })
})

import { articlesFixture, experimentsFixture, linkedinFixture } from './fixtures'
import { ArticlesWire, ExperimentsWire, LinkedinWire, normalizeArticles, normalizeExperiments, normalizeLinkedin, slugify } from './schemas'

describe('organic growth schemas', () => {
  it('accept the fixtures and normalize them', () => {
    const a = normalizeArticles(ArticlesWire.parse(articlesFixture()))
    expect(a.articles[0].slug).toBe('vrijwilligerswerk-met-honden')
    expect(a.articles[1].slug).toBe('wat-je-moet-weten-voor-je-eerste-rondje')
    expect(a.keywords[0].difficulty).toBe('S')
    const e = normalizeExperiments(ExperimentsWire.parse(experimentsFixture()))
    expect(e[0].ice).toBe(7.3)
    expect(e.map((x) => x.ice)).toEqual([...e.map((x) => x.ice)].sort((x, y) => y - x))
    const l = normalizeLinkedin(LinkedinWire.parse(linkedinFixture()))
    expect(l.posts[0].hashtags).toEqual(['#vrijwilligerswerk', '#dierenwelzijn', '#Rondje'])
  })

  it('makes clean slugs and clamps scores', () => {
    expect(slugify('Ça va? Hoe wérkt "X" — echt!')).toBe('ca-va-hoe-werkt-x-echt')
    expect(slugify('!!!')).toBe('artikel')
    const [x] = normalizeExperiments({ experiments: [{ ...experimentsFixture().experiments[0], impact: 99, confidence: -3, ease: Number.NaN }] })
    expect([x.impact, x.confidence, x.ease]).toEqual([10, 1, 5])
  })
})

describe('measured experiments', () => {
  it('keeps a known metric with its target and clamps the days; drops an unknown metric', () => {
    const base = { title: 'Gratis check', hypothesis: 'Als…', channel: 'site', steps: ['a'], metric: 'aanvragen', target: '10', impact: 7, confidence: 6, ease: 8, cost: '€0' }
    const [measured, unknown] = normalizeExperiments({
      experiments: [
        { ...base, metricKey: 'leads', targetValue: 10, days: 60 },
        { ...base, title: 'B', metricKey: 'happiness', targetValue: 3 },
      ],
    })
    expect(measured).toMatchObject({ metricKey: 'leads', targetValue: 10, days: 42 })
    expect(unknown).toMatchObject({ metricKey: null, targetValue: null, days: 14 })
  })
})
