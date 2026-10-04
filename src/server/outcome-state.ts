import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayOf } from '@/lib/dates'
import { analyzeFunnel, type FunnelAnalysis } from '@/lib/funnel'
import type { GrowthModel } from '@/lib/growth-model'
import { bucketWeeks, formatMetric, formatPct, isMetricKey, lastWeeks, METRIC_DEFS, metricName, SOURCE_LABELS, type Source, weeklyFlow } from '@/lib/metrics'
import { outcomeStep, type OutcomeStep } from '@/lib/outcome'
import { pace, PACE_LABELS, type Pace } from '@/lib/pace'
import { dailySeries, loadPoints, type PointRow } from './points'

export interface OutcomeState {
  model: GrowthModel | null
  proposal: { id: string; model: GrowthModel; createdAt: Date } | null
  pace: Pace | null
  funnel: FunnelAnalysis | null
  /** The weeks the funnel and the spark cover (Mondays, oldest first). */
  weeks: string[]
  stages: { key: string; label: string; weeks: (number | null)[] }[]
  /** The target number per week, for a sparkline. */
  spark: (number | null)[]
  /** Sources that delivered something in the last 30 days. */
  sources: Source[]
  step: OutcomeStep | null
}

const WEEKS = 8

/** Model, pace, funnel and the next step for every project of the owner, in a few queries. */
export async function outcomeStates(db: Db, ownerId: string, now = new Date()): Promise<Map<string, OutcomeState>> {
  const today = dayOf(now)
  const [projects, briefs, rows] = await Promise.all([
    db.select({ id: s.project.id, model: s.project.growthModel, stage: s.project.stage }).from(s.project).where(eq(s.project.ownerId, ownerId)),
    db
      .select({ id: s.brief.id, projectId: s.brief.projectId, content: s.brief.content, createdAt: s.brief.createdAt })
      .from(s.brief)
      .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'model')))
      .orderBy(desc(s.brief.createdAt)),
    loadPoints(db, ownerId, addDays(today, -150)),
  ])
  const out = new Map<string, OutcomeState>()
  for (const project of projects) {
    const model = project.model ?? null
    const latest = briefs.find((b) => b.projectId === project.id)
    const proposal = latest && latest.id !== model?.fromBrief ? { id: latest.id, model: latest.content as GrowthModel, createdAt: latest.createdAt } : null
    out.set(project.id, outcomeFor(project.id, model, proposal, rows, today, project.stage))
  }
  return out
}

/** Stages where a business should have a growth target; earlier, a model is premature. */
const MODEL_STAGES = ['launch', 'growth', 'maintain']

/** The same for one project. */
export function outcomeFor(projectId: string, model: GrowthModel | null, proposal: OutcomeState['proposal'], rows: PointRow[], today: string, stage = 'growth'): OutcomeState {
  const weeks = lastWeeks(today, WEEKS)
  const own = rows.filter((r) => r.projectId === projectId)
  const recent = addDays(today, -30)
  const sources = [...new Set(own.filter((r) => r.day >= recent).map((r) => r.source))].filter((src): src is Source => src in SOURCE_LABELS)
  if (!model || !isMetricKey(model.northStar.key)) {
    const step = proposal || MODEL_STAGES.includes(stage) ? outcomeStep({ hasModel: false, hasProposal: Boolean(proposal), northStarKey: null, pace: null, bottleneck: null }) : null
    return { model: null, proposal, pace: null, funnel: null, weeks, stages: [], spark: [], sources, step }
  }
  const ns = model.northStar
  const def = METRIC_DEFS[ns.key]
  const northDaily = dailySeries(own, projectId, ns.key)
  const p = pace(ns, def, northDaily, today)
  const stages = model.funnel.filter((st) => isMetricKey(st.key)).map((st) => ({ key: st.key, label: st.label, rate: st.rate, weeks: weeklyFlow(dailySeries(own, projectId, st.key), METRIC_DEFS[st.key], weeks) }))
  const funnel = stages.length >= 2 ? analyzeFunnel(stages, neededOutcome(model, p)) : null
  return {
    model,
    proposal,
    pace: p,
    funnel,
    weeks,
    stages: stages.map(({ key, label, weeks: w }) => ({ key, label, weeks: w })),
    spark: bucketWeeks(northDaily, def, weeks),
    sources,
    step: outcomeStep({ hasModel: true, hasProposal: Boolean(proposal), northStarKey: ns.key, pace: p, bottleneck: funnel?.bottleneck ?? null }),
  }
}

/** What the last stage of the funnel has to deliver per week for the target to be reached. */
function neededOutcome(model: GrowthModel, p: Pace): number | null {
  const last = model.funnel.at(-1)?.key
  const ns = model.northStar.key
  if (p.neededPerWeek == null || p.neededPerWeek <= 0 || !last) return null
  if (last === ns) return p.neededPerWeek
  if ((ns === 'mrr' || ns === 'revenue') && model.valuePerDeal) return p.neededPerWeek / model.valuePerDeal
  if (ns === 'customers' && last === 'deals_won') return p.neededPerWeek
  return null
}

/** One line on the pace, for lists and for Claude. */
export function paceLine(model: GrowthModel, p: Pace): string {
  const key = model.northStar.key
  const now = p.current == null ? 'nog geen cijfer' : formatMetric(key, p.current)
  const flow = METRIC_DEFS[key].agg === 'sum' ? ' per 30 dagen' : ''
  return `${metricName(key)}: ${now}${flow} van ${formatMetric(key, model.northStar.target)} vóór ${model.northStar.deadline} · ${PACE_LABELS[p.status]}`
}

/**
 * The growth block for Claude's brief: the model, the pace, 8 weeks per stage, the leak and the
 * sources. Numbers only, in a fixed order, so the same state always gives the same text.
 */
export function growthText(state: OutcomeState): string {
  if (!state.model || !state.pace) return state.proposal ? 'A growth model was proposed but not accepted yet.' : 'No growth model yet.'
  const { model, pace: p, funnel } = state
  const lines = [
    `Target: ${model.northStar.key} ${model.northStar.target}${METRIC_DEFS[model.northStar.key].agg === 'sum' ? ' per 30 days' : ''} by ${model.northStar.deadline} (baseline ${model.northStar.baseline ?? 'unknown'} on ${model.northStar.startedOn ?? 'unknown'}).`,
    `Pace: ${p.status}; now ${p.current ?? 'no data'}, the line expects ${p.expected == null ? 'unknown' : Math.round(p.expected * 100) / 100}; needed per week ${p.neededPerWeek == null ? 'unknown' : Math.round(p.neededPerWeek * 100) / 100}, recent per week ${p.recentPerWeek == null ? 'unknown' : Math.round(p.recentPerWeek * 100) / 100}.`,
    `Funnel, inflow per week (weeks starting ${state.weeks[0]} … ${state.weeks.at(-1)}):`,
    ...state.stages.map((st, i) => `- ${st.key}: ${st.weeks.map((w) => (w == null ? '–' : Math.round(w * 100) / 100)).join(', ')}${i && model.funnel[i]?.rate != null ? ` (expected conversion from the stage before: ${model.funnel[i].rate})` : ''}`),
  ]
  const b = funnel?.bottleneck
  if (b?.kind === 'step') lines.push(`Bottleneck: ${b.from} → ${b.to} converts ${Math.round(b.actual * 1000) / 10}%, expected ${Math.round(b.expected * 1000) / 10}%.`)
  else if (b?.kind === 'volume') lines.push(`Bottleneck: volume at the top (${b.key}, ~${Math.round(b.perWeek)} per week${b.neededPerWeek != null ? `, about ${Math.ceil(b.neededPerWeek)} needed` : ''}${b.lowData ? '; too little data to judge the steps' : ''}).`)
  else if (b?.kind === 'no_data') lines.push(`Bottleneck: no numbers yet for ${b.key}.`)
  if (model.valuePerDeal) lines.push(`Value per deal: €${model.valuePerDeal}.`)
  lines.push(`Sources in the last 30 days: ${state.sources.length ? state.sources.join(', ') : 'none'}.`)
  return lines.join('\n')
}

/** The bottleneck in a few words, for lists and the portfolio. */
export function bottleneckLine(state: OutcomeState): string | null {
  const b = state.funnel?.bottleneck
  if (!b) return null
  if (b.kind === 'step') return `lekt bij ${b.fromLabel.toLowerCase()} → ${b.toLabel.toLowerCase()} (${formatPct(b.actual)}, verwacht ${formatPct(b.expected)})`
  if (b.kind === 'volume') return b.lowData ? `nog te weinig ${b.label.toLowerCase()} om te oordelen` : `te weinig ${b.label.toLowerCase()} bovenin`
  return `geen cijfers voor ${b.label.toLowerCase()}`
}

/** What the cockpit already knows per metric for a project, for the brief that asks for a growth model. */
export function dataSummary(rows: PointRow[], projectId: string, today: string): string {
  const weeks = lastWeeks(today, 8)
  const own = rows.filter((r) => r.projectId === projectId)
  const keys = [...new Set(own.map((r) => r.key))].filter(isMetricKey).sort()
  return keys
    .map((key) => {
      const sources = [...new Set(own.filter((r) => r.key === key).map((r) => r.source))].sort().join(', ')
      const values = bucketWeeks(dailySeries(own, projectId, key), METRIC_DEFS[key], weeks)
      return `- ${key} (${sources}): ${values.map((v) => (v == null ? '–' : Math.round(v * 100) / 100)).join(', ')}`
    })
    .join('\n')
}

/** The health tip from the numbers: how far behind, and what it takes. */
export function paceTip(model: GrowthModel, p: Pace): string | null {
  const key = model.northStar.key
  if (p.status === 'no_data') return `Geen cijfers voor ${metricName(key).toLowerCase()}`
  if (p.status === 'overdue') return 'Deadline van het doel voorbij'
  if (p.status !== 'behind' && p.status !== 'far_behind') return null
  if (METRIC_DEFS[key].agg === 'last' && p.neededPerWeek != null) return `Achter op schema: nodig +${formatMetric(key, Math.ceil(p.neededPerWeek))}/week`
  if (p.recentPerWeek != null && p.neededPerWeek != null)
    return `Achter op schema: nu ~${formatMetric(key, Math.round(p.recentPerWeek))}/week, nodig ${formatMetric(key, Math.ceil(p.neededPerWeek))}`
  return 'Achter op schema'
}

/** Where an outcome step is done. */
export function outcomeHref(projectId: string, place: OutcomeStep['place']): string {
  if (place === 'numbers') return `/projects/${projectId}/numbers`
  if (place === 'contacts') return `/projects/${projectId}/contacts`
  if (place === 'brain') return `/projects/${projectId}/brain`
  return `/studio?${new URLSearchParams({ tab: 'experiments', project: projectId }).toString()}`
}

export interface LessonBody {
  result?: string
  learning?: string
  metricKey?: string | null
  baseline?: number | null
  actual?: number | null
  days?: number | null
}

/** One lesson in one line: what was tried, whether it worked, what the numbers did, what he learned. */
export function lessonLine(title: string, body: LessonBody): string {
  const verdict = body.result === 'won' ? 'worked' : body.result === 'lost' ? 'did not work' : 'unclear'
  const numbers =
    body.metricKey && isMetricKey(body.metricKey) && body.actual != null
      ? ` (${body.metricKey}: ${body.baseline ?? '?'} → ${body.actual}${body.days ? ` in ${body.days} days` : ''})`
      : ''
  return `${title}: ${verdict}${numbers}.${body.learning ? ` ${body.learning}` : ''}`
}
