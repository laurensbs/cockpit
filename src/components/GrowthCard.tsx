import Link from 'next/link'
import type { GrowthModel } from '@/lib/growth-model'
import { formatMetric, METRIC_DEFS, metricName, SOURCE_LABELS, type Source } from '@/lib/metrics'
import { PACE_LABELS, type Pace, type PaceStatus } from '@/lib/pace'
import { Icon } from './Icon'
import { Sparkline } from './Sparkline'

export const PACE_TONE: Record<PaceStatus, string> = { done: 'good', ahead: 'good', on_track: 'good', behind: 'warn', far_behind: 'bad', overdue: 'bad', no_data: '' }

/** A small chip with the pace, for lists. */
export function PaceChip({ status }: { status: PaceStatus }) {
  return <span className={`chip ${PACE_TONE[status]}`}>{PACE_LABELS[status]}</span>
}

/** The target and how it is going: the number now, the line it should follow, what it takes per week. */
export function GrowthCard({ projectId, model, pace, spark, sources, link = true }: { projectId: string; model: GrowthModel; pace: Pace; spark: (number | null)[]; sources: Source[]; link?: boolean }) {
  const key = model.northStar.key
  const flow = METRIC_DEFS[key].agg === 'sum'
  const per = flow ? ' per 30 dagen' : ''
  return (
    <section className="card growth-card stack-s" aria-labelledby="growth-title">
      <div className="row between">
        <h2 id="growth-title" className="row">
          <Icon name="chart" size={20} /> Doel: {metricName(key)}
        </h2>
        <PaceChip status={pace.status} />
      </div>
      <div className="row between growth-numbers">
        <p>
          <span className="growth-now num">{pace.current == null ? '–' : formatMetric(key, pace.current)}</span>
          <span className="muted">
            {' '}
            van {formatMetric(key, model.northStar.target)}
            {per}
          </span>
        </p>
        <p className="tiny muted">
          vóór {model.northStar.deadline} · nog {Math.max(0, Math.round(pace.weeksLeft))} weken
        </p>
      </div>
      <div className="bar growth-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pace.progress * 100)} aria-label={`Op weg naar ${formatMetric(key, model.northStar.target)}`}>
        <span style={{ width: `${Math.round(pace.progress * 100)}%` }} />
        {pace.expected != null && pace.baseline != null && model.northStar.target !== pace.baseline ? (
          <i className="growth-line" style={{ left: `${Math.min(100, Math.max(0, Math.round(((pace.expected - pace.baseline) / (model.northStar.target - pace.baseline)) * 100)))}%` }} title="Waar je nu volgens schema zou zijn" />
        ) : null}
      </div>
      <div className="row between">
        <p className="tiny muted">
          {pace.status === 'no_data'
            ? 'Nog geen (recente) cijfers: koppel een bron of vul ze in onder Cijfers.'
            : flow
              ? `Nu ~${formatMetric(key, Math.round(pace.recentPerWeek ?? 0))} per week; het doel vraagt ${formatMetric(key, Math.ceil(pace.neededPerWeek ?? 0))} per week.`
              : pace.neededPerWeek != null
                ? `Nodig: +${formatMetric(key, Math.ceil(Math.max(0, pace.neededPerWeek)))} per week${pace.recentPerWeek != null ? `; de laatste vier weken +${formatMetric(key, Math.round(pace.recentPerWeek))} per week` : ''}.`
                : ''}
        </p>
        <span style={{ width: 96, flex: 'none' }}>
          <Sparkline values={spark.map((v) => v ?? 0)} height={24} label={`${metricName(key)}, 8 weken`} />
        </span>
      </div>
      <div className="row between">
        <span className="row tiny muted">
          {sources.length ? sources.map((src) => <span key={src} className="chip">{SOURCE_LABELS[src]}</span>) : 'Geen bronnen de laatste 30 dagen'}
        </span>
        {link ? (
          <Link href={`/projects/${projectId}/numbers`} className="button ghost small">
            Cijfers <Icon name="arrow" size={14} />
          </Link>
        ) : null}
      </div>
    </section>
  )
}
