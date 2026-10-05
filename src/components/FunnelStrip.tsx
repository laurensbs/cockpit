import type { FunnelAnalysis } from '@/lib/funnel'
import { formatPct } from '@/lib/metrics'
import { formatNumber } from '@/lib/time'

const pct = (r: number | null) => (r == null ? '–' : formatPct(r))

/** The funnel over the last 8 weeks: per stage what came in, per step the conversion, the leak marked. */
export function FunnelStrip({ stages, funnel }: { stages: { key: string; label: string }[]; funnel: FunnelAnalysis }) {
  const b = funnel.bottleneck
  return (
    <section className="card stack-s" aria-labelledby="funnel-title">
      <div className="row between">
        <h2 id="funnel-title">Van contact tot klant</h2>
        <span className="tiny muted">Laatste 8 weken</span>
      </div>
      <ol className="funnel">
        {stages.map((stage, i) => {
          const step = i > 0 ? funnel.steps[i - 1] : null
          const leak = (b?.kind === 'step' && b.to === stage.key) || (b?.kind === 'volume' && i === 0) || (b?.kind === 'no_data' && b.key === stage.key)
          return (
            <li key={stage.key} className={leak ? 'leak' : undefined}>
              {step ? (
                <span className="funnel-step tiny" title={step.expected != null ? `Verwacht ${pct(step.expected)}` : undefined}>
                  {pct(step.actual)}
                  {step.expected != null ? <span className="muted"> / {pct(step.expected)}</span> : null}
                </span>
              ) : null}
              <span className="funnel-stage">
                <strong className="num">{funnel.totals[i] == null ? '–' : formatNumber(Math.round(funnel.totals[i]!))}</strong>
                <span className="tiny muted">{stage.label}</span>
              </span>
            </li>
          )
        })}
      </ol>
      {b ? (
        <p className="small funnel-verdict">
          {b.kind === 'step'
            ? `Hier lekt het: ${b.fromLabel.toLowerCase()} → ${b.toLabel.toLowerCase()} haalt ${pct(b.actual)}, verwacht ${pct(b.expected)}.`
            : b.kind === 'volume'
              ? b.lowData
                ? `Nog te weinig ${b.label.toLowerCase()} om de stappen te beoordelen: eerst meer instroom.`
                : `Elke stap doet wat hij moet; er komt te weinig binnen: ~${Math.round(b.perWeek)} ${b.label.toLowerCase()} per week${b.neededPerWeek != null ? `, nodig ~${Math.ceil(b.neededPerWeek)}` : ''}.`
              : `Nog geen cijfers voor ${b.label.toLowerCase()}.`}
        </p>
      ) : null}
    </section>
  )
}
