// Where the funnel leaks. Per stage the weekly inflow over the last 8 full weeks; per step the actual
// conversion compared with what the model expects. The bottleneck is not "the lowest conversion" (the
// first step, visitor → lead, is always the lowest) but the step that falls furthest short of what it
// should do. When every step does fine, the problem is volume at the top. Pure, so it is testable.

export interface FunnelInput {
  key: string
  label: string
  /** Expected conversion from the stage before (0–1), from the model; null when unknown. */
  rate: number | null
  /** Inflow per week, oldest first; null for a week without numbers. */
  weeks: (number | null)[]
}

export interface FunnelStep {
  from: string
  to: string
  fromLabel: string
  toLabel: string
  actual: number | null
  expected: number | null
  /** Inflow into the step over the period: below MIN_VOLUME the rate says little. */
  fromTotal: number
}

export type Bottleneck =
  | { kind: 'no_data'; key: string; label: string }
  | { kind: 'step'; from: string; to: string; fromLabel: string; toLabel: string; actual: number; expected: number }
  | { kind: 'volume'; key: string; label: string; perWeek: number; neededPerWeek: number | null; lowData: boolean }

export interface FunnelAnalysis {
  totals: (number | null)[]
  steps: FunnelStep[]
  bottleneck: Bottleneck | null
}

/** Below this many entries a conversion is noise, not a signal. */
export const MIN_VOLUME = 10
/** A step counts as the leak when it does less than this share of what it should. */
const SHORTFALL = 0.8
/** Without an expected rate: a drop of this much against the weeks before. */
const DROP = 0.3

const total = (weeks: (number | null)[]) => (weeks.some((w) => w != null) ? weeks.reduce<number>((sum, w) => sum + (w ?? 0), 0) : null)
const rateOf = (to: number | null, from: number | null) => (to != null && from != null && from > 0 ? to / from : null)

/**
 * The funnel's steps and its bottleneck. `neededOutcomePerWeek` is what the last stage has to deliver
 * per week for the target; with it, the volume bottleneck says how much has to come in at the top.
 */
export function analyzeFunnel(stages: FunnelInput[], neededOutcomePerWeek: number | null = null): FunnelAnalysis {
  const totals = stages.map((s) => total(s.weeks))
  const steps: FunnelStep[] = stages.slice(1).map((to, i) => {
    const from = stages[i]
    return { from: from.key, to: to.key, fromLabel: from.label, toLabel: to.label, actual: rateOf(totals[i + 1], totals[i]), expected: to.rate, fromTotal: totals[i] ?? 0 }
  })
  if (!stages.length) return { totals, steps, bottleneck: null }

  const empty = stages.findIndex((_, i) => totals[i] == null)
  if (empty !== -1) return { totals, steps, bottleneck: { kind: 'no_data', key: stages[empty].key, label: stages[empty].label } }

  // The step that falls furthest short of what is expected, with enough volume to judge it.
  let worst: { step: FunnelStep; ratio: number; expected: number } | null = null
  for (const [i, step] of steps.entries()) {
    if (step.fromTotal < MIN_VOLUME || step.actual == null) continue
    let expected = step.expected
    if (expected == null) {
      // No expectation: compare the last four weeks with the four before.
      const from = stages[i].weeks
      const to = stages[i + 1].weeks
      const before = rateOf(total(to.slice(0, -4)), total(from.slice(0, -4)))
      const recent = rateOf(total(to.slice(-4)), total(from.slice(-4)))
      if (before == null || recent == null || before === 0 || recent >= before * (1 - DROP)) continue
      expected = before
      const ratio = recent / before
      if (!worst || ratio < worst.ratio) worst = { step: { ...step, actual: recent }, ratio, expected }
      continue
    }
    const ratio = step.actual / expected
    if (ratio < SHORTFALL && (!worst || ratio < worst.ratio)) worst = { step, ratio, expected }
  }
  if (worst) {
    const { step, expected } = worst
    return { totals, steps, bottleneck: { kind: 'step', from: step.from, to: step.to, fromLabel: step.fromLabel, toLabel: step.toLabel, actual: step.actual!, expected } }
  }

  // Every step does what it should: more has to come in at the top.
  const top = stages[0]
  const weeksWithData = top.weeks.filter((w) => w != null).length || 1
  const perWeek = (totals[0] ?? 0) / weeksWithData
  let neededPerWeek: number | null = null
  if (neededOutcomePerWeek != null && neededOutcomePerWeek > 0) {
    const chain = steps.map((s) => s.actual ?? s.expected)
    if (chain.every((r): r is number => r != null && r > 0)) neededPerWeek = neededOutcomePerWeek / chain.reduce((p, r) => p * r, 1)
  }
  return { totals, steps, bottleneck: { kind: 'volume', key: top.key, label: top.label, perWeek, neededPerWeek, lowData: (totals[0] ?? 0) < MIN_VOLUME } }
}
