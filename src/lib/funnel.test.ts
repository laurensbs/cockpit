import { describe, expect, it } from 'vitest'
import { analyzeFunnel, type FunnelInput } from './funnel'

const weeks = (...values: (number | null)[]) => values
const stage = (key: string, rate: number | null, w: (number | null)[]): FunnelInput => ({ key, label: key, rate, weeks: w })

describe('analyzeFunnel', () => {
  it('names the first stage without numbers', () => {
    const r = analyzeFunnel([stage('visitors', null, weeks(100, 120)), stage('leads', 0.02, weeks(null, null))])
    expect(r.bottleneck).toEqual({ kind: 'no_data', key: 'leads', label: 'leads' })
  })

  it('finds the step that falls furthest short of what is expected, not the lowest conversion', () => {
    const r = analyzeFunnel([
      stage('visitors', null, weeks(500, 500)), // 1000
      stage('leads', 0.02, weeks(10, 10)), // 2%: as expected (lowest conversion, but fine)
      stage('meetings', 0.4, weeks(2, 2)), // 20% vs 40% expected: the leak
      stage('deals_won', 0.25, weeks(1, 0)), // 25%: fine
    ])
    expect(r.bottleneck).toMatchObject({ kind: 'step', from: 'leads', to: 'meetings', actual: 0.2, expected: 0.4 })
    expect(r.steps.map((s) => s.actual)).toEqual([0.02, 0.2, 0.25])
  })

  it('ignores a step with too little volume to judge', () => {
    const r = analyzeFunnel([stage('leads', null, weeks(4, 4)), stage('meetings', 0.5, weeks(0, 1))])
    expect(r.bottleneck).toMatchObject({ kind: 'volume', key: 'leads', lowData: true })
  })

  it('without an expected rate, a drop of more than 30% against the weeks before is the leak', () => {
    const r = analyzeFunnel([
      stage('leads', null, weeks(10, 10, 10, 10, 10, 10, 10, 10)),
      stage('meetings', null, weeks(5, 5, 5, 5, 2, 2, 2, 2)),
    ])
    expect(r.bottleneck).toMatchObject({ kind: 'step', to: 'meetings', actual: 0.2, expected: 0.5 })
  })

  it('when every step works, the top has to grow: and says how much is needed', () => {
    const r = analyzeFunnel(
      [stage('visitors', null, weeks(400, 400)), stage('leads', 0.02, weeks(8, 8)), stage('deals_won', 0.25, weeks(2, 2))],
      2,
    )
    expect(r.bottleneck).toMatchObject({ kind: 'volume', key: 'visitors', perWeek: 400, lowData: false })
    expect(r.bottleneck?.kind === 'volume' && r.bottleneck.neededPerWeek).toBeCloseTo(2 / (0.02 * 0.25), 5)
  })
})
