'use client'

import { useState, useTransition } from 'react'
import type { GrowthModel } from '@/lib/growth-model'
import { formatMetric, formatPct, metricName } from '@/lib/metrics'
import { acceptModel, dismissModel } from '@/server/actions/model'
import { useCelebrate } from './CelebrationProvider'

/** Claude's proposal for the growth model: he reads it, then accepts or throws it away. */
export function ModelProposal({ briefId, model }: { briefId: string; model: GrowthModel }) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const celebrate = useCelebrate()
  const ns = model.northStar
  return (
    <section className="card proposal stack-s" aria-labelledby="proposal-title">
      <p className="eyebrow">Voorstel van Claude</p>
      <h2 id="proposal-title">
        {metricName(ns.key)} naar {formatMetric(ns.key, ns.target)} vóór {ns.deadline}
      </h2>
      <ol className="row proposal-funnel">
        {model.funnel.map((st, i) => (
          <li key={st.key} className="chip">
            {i > 0 && st.rate != null ? <span className="muted">{formatPct(st.rate)} → </span> : null}
            {st.label}
          </li>
        ))}
      </ol>
      {model.valuePerDeal ? <p className="tiny muted">Waarde per deal: {formatMetric('revenue', model.valuePerDeal)}</p> : null}
      {model.note ? <p className="small prewrap">{model.note}</p> : null}
      <div className="row">
        <button
          type="button"
          className="button primary small"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await acceptModel(briefId)
              setMessage(r.message)
              const xp = Number(r.message.match(/\+(\d+) XP/)?.[1] ?? 0)
              if (xp) celebrate({ xp, levelUp: null, badges: [] })
            })
          }
        >
          Dit doel overnemen
        </button>
        <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => dismissModel(briefId))}>
          Niet dit doel
        </button>
        {message ? (
          <span className="tiny muted" role="status">
            {message}
          </span>
        ) : null}
      </div>
    </section>
  )
}
