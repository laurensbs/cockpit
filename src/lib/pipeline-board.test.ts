import { describe, expect, it } from 'vitest'
import { boardColumns, type Deal, dealQuests, dueOf, nextStage, prevStage, wonRevenue, worthOf } from './pipeline-board'

const deal = (over: Partial<Deal>): Deal => ({ id: 'c1', organization: 'Bakker Jansen', status: 'replied', value: null, period: null, nextStep: '', nextStepOn: null, ...over })

describe('the pipeline board', () => {
  it('moves one step on or back', () => {
    expect(nextStage('replied')).toBe('meeting')
    expect(nextStage('offer')).toBe('won')
    expect(nextStage('won')).toBeNull()
    expect(prevStage('meeting')).toBe('replied')
    expect(prevStage('replied')).toBeNull()
    expect(prevStage('lost')).toBe('replied')
  })

  it('adds up what deals are worth, monthly and once', () => {
    expect(worthOf([deal({ value: 150, period: 'month' }), deal({ value: 2000, period: 'once' }), deal({ value: 99, period: null }), deal({})])).toEqual({ monthly: 249, once: 2000 })
  })

  it('says when a next step is due, only for open deals', () => {
    expect(dueOf({ status: 'meeting', nextStepOn: '2026-10-01' }, '2026-10-05')).toBe('late')
    expect(dueOf({ status: 'offer', nextStepOn: '2026-10-05' }, '2026-10-05')).toBe('today')
    expect(dueOf({ status: 'offer', nextStepOn: '2026-10-08' }, '2026-10-05')).toBe('soon')
    expect(dueOf({ status: 'offer', nextStepOn: '2026-10-09' }, '2026-10-05')).toBeNull()
    expect(dueOf({ status: 'won', nextStepOn: '2026-10-01' }, '2026-10-05')).toBeNull()
  })

  it('puts deals in their column, the earliest step first', () => {
    const cols = boardColumns([
      deal({ id: 'a', organization: 'Zeeman', status: 'meeting', nextStepOn: '2026-10-09', value: 100, period: 'month' }),
      deal({ id: 'b', organization: 'Aalders', status: 'meeting', nextStepOn: '2026-10-02', value: 50, period: 'month' }),
      deal({ id: 'c', status: 'won', value: 1500, period: 'once' }),
      deal({ id: 'd', status: 'sent' }),
    ])
    expect(cols.map((c) => c.label)).toEqual(['Lead', 'Gesprek', 'Offerte', 'Gewonnen', 'Verloren'])
    expect(cols[1].deals.map((d) => d.id)).toEqual(['b', 'a'])
    expect(cols[1].worth).toEqual({ monthly: 150, once: 0 })
    expect(cols[3].worth).toEqual({ monthly: 0, once: 1500 })
    expect(cols.flatMap((c) => c.deals).some((d) => d.id === 'd')).toBe(false)
  })

  it('makes a quest of a due next step, once per date', () => {
    const quests = dealQuests(
      [
        { ...deal({ id: 'a', status: 'offer', nextStep: 'Bellen over de offerte', nextStepOn: '2026-10-05' }), projectId: 'p1' },
        { ...deal({ id: 'b', status: 'meeting', nextStep: 'Agenda sturen', nextStepOn: '2026-10-06' }), projectId: 'p1' },
        { ...deal({ id: 'c', status: 'won', nextStep: 'Factuur', nextStepOn: '2026-10-01' }), projectId: 'p1' },
        { ...deal({ id: 'd', status: 'replied', nextStepOn: '2026-10-01' }), projectId: 'p1' },
      ],
      '2026-10-05',
    )
    expect(quests).toEqual([{ sourceKey: 'deal:a:2026-10-05', projectId: 'p1', title: 'Bellen over de offerte: Bakker Jansen', detail: expect.stringContaining('Contacten → Bord'), xp: 15, dueOn: '2026-10-05' }])
  })

  it('counts won deals as revenue: monthly as MRR, once on the day it was won', () => {
    const r = wonRevenue([
      { value: 150, period: 'month', wonOn: '2026-09-01' },
      { value: 2000, period: 'once', wonOn: '2026-10-02' },
      { value: 500, period: 'once', wonOn: '2026-10-02' },
      { value: null, period: null, wonOn: '2026-10-03' },
    ])
    expect(r.mrr).toBe(150)
    expect(r.customers).toBe(4)
    expect([...r.revenue]).toEqual([['2026-10-02', 2500]])
  })
})
