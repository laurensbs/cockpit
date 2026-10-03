import { describe, expect, it } from 'vitest'
import { BADGES, currentStreak, earnedBadges, isComeback, levelFor, longestStreak, projectHealth, xpForLevel, type BadgeStats, type HealthInput } from './game'

describe('levels', () => {
  it('needs 0, 100, 300, 600, 1000 XP for levels 1 to 5', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000])
  })

  it('gives the level, title and progress within it', () => {
    expect(levelFor(0)).toMatchObject({ level: 1, title: 'Dromer', current: 0, needed: 100, progress: 0 })
    expect(levelFor(99).level).toBe(1)
    expect(levelFor(100)).toMatchObject({ level: 2, title: 'Knutselaar', current: 0, needed: 200 })
    expect(levelFor(450)).toMatchObject({ level: 3, title: 'Bouwer', current: 150, needed: 300, progress: 0.5 })
    expect(levelFor(1_000_000).title).toBe('Legende')
  })
})

const set = (...days: string[]) => new Set(days)

describe('streaks', () => {
  it('counts consecutive active days, also before today is done', () => {
    expect(currentStreak(set('2026-10-01', '2026-10-02', '2026-10-03'), '2026-10-03')).toEqual({ length: 3, today: true, frozen: [] })
    expect(currentStreak(set('2026-10-01', '2026-10-02'), '2026-10-03')).toEqual({ length: 2, today: false, frozen: [] })
  })

  it('bridges one missed day per week with a freeze', () => {
    // Thu 1, Fri 2 active, Sat 3 missed, Sun 4 active.
    expect(currentStreak(set('2026-10-01', '2026-10-02', '2026-10-04'), '2026-10-04')).toEqual({ length: 3, today: true, frozen: ['2026-10-03'] })
  })

  it('keeps the streak alive when yesterday was missed but today is not over', () => {
    expect(currentStreak(set('2026-09-30', '2026-10-01'), '2026-10-03')).toEqual({ length: 2, today: false, frozen: ['2026-10-02'] })
  })

  it('breaks on a second missed day in the same week', () => {
    // Mon 28 and Tue 29 active, Wed 30 and Thu 1 missed, Fri 2 active.
    expect(currentStreak(set('2026-09-28', '2026-09-29', '2026-10-02'), '2026-10-02').length).toBe(1)
  })

  it('is zero without activity, and never starts with a freeze', () => {
    expect(currentStreak(set(), '2026-10-03').length).toBe(0)
    expect(currentStreak(set('2026-09-01'), '2026-10-03').length).toBe(0)
  })

  it('finds the longest run', () => {
    const days = set('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-11')
    expect(longestStreak(days)).toBe(3)
  })
})

const health = (over: Partial<HealthInput> = {}): HealthInput => ({
  today: '2026-10-03',
  hasRepos: true,
  commitDays: {},
  actionDays: set(),
  marketingDays: set(),
  planDay: null,
  questsDone: 0,
  questsMissed: 0,
  intakeDone: true,
  ...over,
})

describe('project health', () => {
  it('is low with reasons for a quiet project without a plan', () => {
    const h = projectHealth(health())
    expect(h.score).toBe(10)
    expect(h.tips).toEqual(['Weinig gebouwd de laatste twee weken', 'Twee weken geen marketing', 'Nog geen marketingplan'])
  })

  it('is full for a busy, marketed project with a fresh plan and quests done', () => {
    const commitDays = Object.fromEntries(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((d) => [d, 2]))
    const marketing = set('2026-09-25', '2026-09-28', '2026-10-01', '2026-10-03')
    const h = projectHealth(health({ commitDays, marketingDays: marketing, actionDays: marketing, planDay: '2026-09-20', questsDone: 4 }))
    expect(h).toEqual({ score: 100, parts: { activity: 30, marketing: 30, plan: 20, quests: 20 }, tips: [] })
  })

  it('judges a project without a repo by what was done for it', () => {
    const h = projectHealth(health({ hasRepos: false, actionDays: set('2026-10-01', '2026-10-02', '2026-10-03') }))
    expect(h.parts.activity).toBe(15)
  })
})

describe('badges', () => {
  const none: BadgeStats = {
    level: 1,
    questsDone: 0,
    bossesDone: 0,
    posts: 0,
    emails: 0,
    replies: 0,
    longestActionStreak: 0,
    plans: 0,
    activeProjects: 5,
    projectsWithPlan: 0,
    firstRevenue: false,
    comeback: false,
  }

  it('earns nothing at the start and the right ones later', () => {
    expect(earnedBadges(none)).toEqual([])
    expect(earnedBadges({ ...none, questsDone: 1, longestActionStreak: 8, level: 5 })).toEqual(['first-quest', 'streak-7', 'level-5'])
    expect(earnedBadges({ ...none, plans: 5, projectsWithPlan: 5 })).toEqual(['first-plan', 'all-plans'])
  })

  it('has unique keys', () => {
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(BADGES.length)
  })

  it('spots a comeback after two quiet weeks', () => {
    expect(isComeback({ '2026-09-01': 3, '2026-10-02': 1 }, '2026-10-03')).toBe(true)
    expect(isComeback({ '2026-09-25': 3, '2026-10-02': 1 }, '2026-10-03')).toBe(false)
    expect(isComeback({ '2026-10-02': 1 }, '2026-10-03')).toBe(false)
  })
})
