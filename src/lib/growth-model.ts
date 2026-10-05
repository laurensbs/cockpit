// The growth model of a project: one target number with a deadline, and the funnel of 2–5 stages that
// leads to it. Claude proposes one; he accepts or edits it. Pure, so the checks are testable.

import { z } from 'zod'
import { addDays } from './dates'
import { isMetricKey, METRIC_DEFS, type MetricKey } from './metrics'

export interface FunnelStage {
  key: MetricKey
  label: string
  /** The expected conversion from the stage before (0–1); null for the first stage or when unknown. */
  rate: number | null
}

export interface GrowthModel {
  northStar: {
    key: MetricKey
    target: number
    deadline: string
    /** The value when he accepted the model; the line to the target starts here. */
    baseline: number | null
    startedOn: string | null
  }
  funnel: FunnelStage[]
  /** What one won deal or customer is worth, in euros (per month for a subscription). */
  valuePerDeal: number | null
  note: string
  /** The proposal it came from, so an accepted proposal is not offered again. */
  fromBrief?: string | null
}

const num = z.union([z.number(), z.string()]).transform((v) => (typeof v === 'number' ? v : Number(String(v).replace(',', '.'))))

/** What Claude (or the form) sends: lenient, so small slips are fixed instead of refused. */
export const ModelWire = z.object({
  northStar: z.object({
    key: z.string(),
    target: num,
    deadline: z.string(),
  }),
  funnel: z
    .array(
      z.object({
        key: z.string(),
        label: z.string().optional(),
        rate: z.union([num, z.null()]).optional(),
      }),
    )
    .max(8),
  valuePerDeal: z.union([num, z.null()]).optional(),
  note: z.string().optional(),
})
export type ModelInput = z.input<typeof ModelWire>

/** Checks a model and makes it whole, or says what is wrong (in Dutch, for him and for Claude). */
export function normalizeModel(input: unknown, today: string): { model: GrowthModel } | { error: string } {
  const parsed = ModelWire.safeParse(input)
  if (!parsed.success) return { error: 'Het model mist onderdelen: northStar { key, target, deadline } en funnel [ { key, label, rate } ].' }
  const { northStar, funnel, valuePerDeal, note } = parsed.data
  if (!isMetricKey(northStar.key)) return { error: `Het doelcijfer "${northStar.key}" bestaat niet. Kies uit: ${Object.keys(METRIC_DEFS).join(', ')}.` }
  if (!Number.isFinite(northStar.target)) return { error: 'Het doel moet een getal zijn.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(northStar.deadline)) return { error: 'De deadline moet een dag zijn als 2026-12-31.' }
  if (northStar.deadline < addDays(today, 14) || northStar.deadline > addDays(today, 365))
    return { error: 'De deadline ligt tussen twee weken en een jaar vanaf vandaag.' }
  if (funnel.length < 2 || funnel.length > 5) return { error: 'Je doel heeft 2 tot 5 stappen ernaartoe.' }
  const seen = new Set<string>()
  const stages: FunnelStage[] = []
  for (const [i, stage] of funnel.entries()) {
    if (!isMetricKey(stage.key)) return { error: `Trap "${stage.key}" bestaat niet. Kies uit: ${Object.keys(METRIC_DEFS).join(', ')}.` }
    if (seen.has(stage.key)) return { error: `Trap "${stage.key}" staat er twee keer in.` }
    seen.add(stage.key)
    const rate = i === 0 || stage.rate == null || !Number.isFinite(stage.rate) ? null : stage.rate > 1 && stage.rate <= 100 ? stage.rate / 100 : stage.rate
    if (rate != null && (rate <= 0 || rate > 1)) return { error: `De conversie naar "${stage.key}" ligt tussen 0 en 1 (of 0 en 100%).` }
    stages.push({ key: stage.key, label: (stage.label ?? '').trim().slice(0, 40) || METRIC_DEFS[stage.key].label, rate })
  }
  const value = valuePerDeal == null || !Number.isFinite(valuePerDeal) || valuePerDeal <= 0 ? null : Math.round(valuePerDeal)
  return {
    model: {
      northStar: { key: northStar.key, target: northStar.target, deadline: northStar.deadline, baseline: null, startedOn: null },
      funnel: stages,
      valuePerDeal: value,
      note: (note ?? '').trim().slice(0, 400),
    },
  }
}
