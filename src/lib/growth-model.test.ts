import { describe, expect, it } from 'vitest'
import { normalizeModel } from './growth-model'

const today = '2026-10-04'
const valid = {
  northStar: { key: 'mrr', target: '3000', deadline: '2027-03-31' },
  funnel: [
    { key: 'visitors', label: 'Bezoekers' },
    { key: 'leads', rate: 2 },
    { key: 'meetings', rate: 0.3 },
    { key: 'deals_won', label: 'Klanten', rate: 0.25 },
  ],
  valuePerDeal: '149',
  note: 'Aanname: 2% van de bezoekers laat iets achter.',
}

describe('normalizeModel', () => {
  it('makes a lenient model whole: numbers from text, percentages to fractions, default labels', () => {
    const result = normalizeModel(valid, today)
    expect('model' in result && result.model).toMatchObject({
      northStar: { key: 'mrr', target: 3000, deadline: '2027-03-31', baseline: null, startedOn: null },
      funnel: [
        { key: 'visitors', label: 'Bezoekers', rate: null },
        { key: 'leads', label: 'Aanvragen', rate: 0.02 },
        { key: 'meetings', rate: 0.3 },
        { key: 'deals_won', label: 'Klanten', rate: 0.25 },
      ],
      valuePerDeal: 149,
    })
  })
  it('refuses what cannot work, and says why', () => {
    const err = (over: object) => {
      const r = normalizeModel({ ...valid, ...over }, today)
      return 'error' in r ? r.error : null
    }
    expect(err({ northStar: { key: 'happiness', target: 1, deadline: '2027-01-01' } })).toContain('bestaat niet')
    expect(err({ northStar: { key: 'mrr', target: 1, deadline: '2026-10-10' } })).toContain('twee weken')
    expect(err({ northStar: { key: 'mrr', target: 1, deadline: '2028-01-01' } })).toContain('een jaar')
    expect(err({ funnel: [{ key: 'leads' }] })).toContain('2 tot 5')
    expect(err({ funnel: [{ key: 'leads' }, { key: 'leads' }] })).toContain('twee keer')
    expect(err({ funnel: [{ key: 'leads' }, { key: 'meetings', rate: 400 }] })).toContain('tussen 0 en 1')
  })
})
