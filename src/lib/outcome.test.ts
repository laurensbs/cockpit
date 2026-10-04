import { describe, expect, it } from 'vitest'
import { outcomeStep } from './outcome'
import type { Pace } from './pace'

const pace = (status: Pace['status']): Pace => ({ status, current: 1200, expected: 1600, target: 3000, baseline: 1000, progress: 0.1, weeksLeft: 20, neededPerWeek: 90, recentPerWeek: 20, projected: 1600 })
const base = { hasModel: true, hasProposal: false, northStarKey: 'mrr', pace: pace('behind'), bottleneck: null }

describe('outcomeStep', () => {
  it('asks for a growth model first, or to accept the one Claude proposed', () => {
    expect(outcomeStep({ ...base, hasModel: false })).toMatchObject({ key: 'model', task: 'model', place: 'numbers' })
    expect(outcomeStep({ ...base, hasModel: false, hasProposal: true })).toMatchObject({ key: 'model-accept', task: null })
  })
  it('asks for numbers when they are missing', () => {
    expect(outcomeStep({ ...base, pace: pace('no_data') })).toMatchObject({ key: 'connect', place: 'numbers' })
    expect(outcomeStep({ ...base, bottleneck: { kind: 'no_data', key: 'meetings', label: 'Gesprekken' } })?.title).toBe('Koppel je cijfers voor gesprekken')
  })
  it('turns a leak into the job that fits it, with the numbers in the why', () => {
    const leads = outcomeStep({ ...base, bottleneck: { kind: 'step', from: 'visitors', to: 'leads', fromLabel: 'Bezoekers', toLabel: 'Leads', actual: 0.01, expected: 0.02 } })
    expect(leads).toMatchObject({ task: 'experiments', options: { focus: 'leads' } })
    expect(leads?.why).toContain('Bezoekers → Leads: 1%, verwacht 2%')
    expect(leads?.why).toMatch(/MRR: €\s1\.200 van €\s3\.000/)
    expect(outcomeStep({ ...base, bottleneck: { kind: 'step', from: 'leads', to: 'meetings', fromLabel: 'Leads', toLabel: 'Gesprekken', actual: 0.1, expected: 0.4 } })).toMatchObject({ task: 'contact_mails', place: 'contacts' })
    expect(outcomeStep({ ...base, bottleneck: { kind: 'step', from: 'meetings', to: 'offers', fromLabel: 'Gesprekken', toLabel: 'Offertes', actual: 0.1, expected: 0.5 } })).toMatchObject({ task: null, place: 'contacts' })
  })
  it('asks for more at the top when every step works and the target is behind', () => {
    const volume = { kind: 'volume' as const, key: 'visitors', label: 'Bezoekers', perWeek: 300, neededPerWeek: 800, lowData: false }
    expect(outcomeStep({ ...base, bottleneck: volume })).toMatchObject({ task: 'seo', key: 'volume-visitors' })
    expect(outcomeStep({ ...base, bottleneck: volume })?.why).toContain('nodig ~800')
    // On track: nothing urgent from the numbers; the usual marketing steps follow.
    expect(outcomeStep({ ...base, pace: pace('on_track'), bottleneck: volume })).toBeNull()
  })
})
