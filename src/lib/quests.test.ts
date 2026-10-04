import { describe, expect, it } from 'vitest'
import { bucketOf, experimentQuests, nextDue, ruleQuests, type RuleProject } from './quests'

describe('recurring quests', () => {
  it('moves the due day by the recurrence, keeping month ends sane', () => {
    expect(nextDue('2026-10-03', 'weekly')).toBe('2026-10-10')
    expect(nextDue('2026-10-31', 'monthly')).toBe('2026-11-30')
    expect(nextDue('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(nextDue('2026-11-15', 'quarterly')).toBe('2027-02-15')
    expect(nextDue('2028-02-29', 'yearly')).toBe('2029-02-28')
    expect(nextDue('2026-10-03', 'none')).toBeNull()
  })
})

const project = (over: Partial<RuleProject> = {}): RuleProject => ({
  id: 'p1',
  name: 'Rondje',
  active: true,
  intakeDone: true,
  hasPlan: true,
  quietDays: 1,
  hasMetricsLastMonth: true,
  syncError: false,
  ...over,
})

describe('rule quests', () => {
  it('asks for nothing when all is well', () => {
    expect(ruleQuests([project()], '2026-10-03', true)).toEqual([])
  })

  it('asks for the intake first, and a plan only once the intake is done and AI is there', () => {
    expect(ruleQuests([project({ intakeDone: false, hasPlan: false })], '2026-10-20', true).map((q) => q.sourceKey)).toEqual(['intake:p1'])
    expect(ruleQuests([project({ hasPlan: false })], '2026-10-20', true).map((q) => q.sourceKey)).toEqual(['plan:p1'])
    expect(ruleQuests([project({ hasPlan: false })], '2026-10-20', false)).toEqual([])
  })

  it('makes him choose about a quiet project, once a week', () => {
    const [q] = ruleQuests([project({ quietDays: 20 })], '2026-10-03', true)
    expect(q).toMatchObject({ sourceKey: 'quiet:p1:2026-09-28', title: 'Rondje ligt al 20 dagen stil: kies' })
  })

  it('asks for last month’s numbers in the first ten days', () => {
    expect(ruleQuests([project({ hasMetricsLastMonth: false })], '2026-10-03', true)[0]).toMatchObject({ sourceKey: 'metrics:p1:2026-09-01', dueOn: '2026-10-10' })
    expect(ruleQuests([project({ hasMetricsLastMonth: false })], '2026-10-15', true)).toEqual([])
  })

  it('asks for a growth target once a launched or growing project has its intake, and not again with a model', () => {
    expect(ruleQuests([project({ stage: 'growth', hasModel: false })], '2026-10-20', true)[0]).toMatchObject({ sourceKey: 'model:p1', title: 'Zet een groeidoel voor Rondje' })
    expect(ruleQuests([project({ stage: 'build', hasModel: false })], '2026-10-20', true)).toEqual([])
    expect(ruleQuests([project({ stage: 'growth', hasModel: true })], '2026-10-20', true)).toEqual([])
  })

  it('says when a source keeps failing, once a week', () => {
    const [q] = ruleQuests([project({ failingSources: [{ id: 'c1', label: 'Stripe', error: 'De sleutel klopt niet of mag dit niet lezen.' }] })], '2026-10-20', true)
    expect(q).toMatchObject({ sourceKey: 'source:c1:2026-10-19', title: 'Stripe van Rondje levert geen cijfers' })
  })

  it('skips paused projects', () => {
    expect(ruleQuests([project({ active: false, intakeDone: false, quietDays: 50 })], '2026-10-03', true)).toEqual([])
  })
})

describe('bucketOf', () => {
  it('sorts quests by when they are due', () => {
    expect(bucketOf('2026-10-01', '2026-10-03')).toBe('overdue')
    expect(bucketOf('2026-10-03', '2026-10-03')).toBe('today')
    expect(bucketOf('2026-10-09', '2026-10-03')).toBe('week')
    expect(bucketOf('2026-10-10', '2026-10-03')).toBe('later')
    expect(bucketOf(null, '2026-10-03')).toBe('someday')
  })
})

describe('experimentQuests', () => {
  it('asks to measure and close an experiment once its time is up, not before', () => {
    const running = [
      { id: 'e1', projectId: 'p1', title: 'Gratis website-check als lokmiddel', endsOn: '2026-10-04' },
      { id: 'e2', projectId: 'p1', title: 'Later', endsOn: '2026-10-20' },
      { id: 'e3', projectId: 'p1', title: 'Zonder einde', endsOn: null },
    ]
    expect(experimentQuests(running, '2026-10-05')).toEqual([
      expect.objectContaining({ sourceKey: 'experiment-end:e1', title: 'Rond af: Gratis website-check als lokmiddel', dueOn: '2026-10-05' }),
    ])
  })
})
