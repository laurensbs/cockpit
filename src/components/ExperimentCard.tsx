'use client'

import { useState, useTransition } from 'react'
import { formatMetric } from '@/lib/metrics'
import { finishExperiment, startExperiment } from '@/server/actions/content'
import { useCelebrate } from './CelebrationProvider'
import { Icon } from './Icon'

export interface ExperimentView {
  id: string
  title: string
  hypothesis: string
  channel: string
  steps: string[]
  metric: string
  target: string
  ice: number
  impact: number
  confidence: number
  ease: number
  cost: string
  status: string
  result: string
  learning: string
  /** Tied to a metric: where it stood at the start, where it is now, and what that suggests. */
  measured: {
    key: string
    label: string
    targetValue: number | null
    startedOn: string | null
    endsOn: string | null
    baseline: number | null
    actual: number | null
    daysLeft: number | null
    lift: number | null
    suggestion: 'won' | 'lost' | null
  } | null
}

const fmt = (key: string, v: number | null) => (v == null ? '–' : formatMetric(key, Math.round(v * 100) / 100))

/** One experiment on the board: start it, then say whether it worked and what you learned. */
export function ExperimentCard({ experiment: e }: { experiment: ExperimentView }) {
  const [pending, start] = useTransition()
  const [finishing, setFinishing] = useState(false)
  const m = e.measured
  const [learning, setLearning] = useState(m && m.actual != null ? `${m.label}: ${fmt(m.key, m.baseline)} → ${fmt(m.key, m.actual)}${m.targetValue != null ? ` (doel ${fmt(m.key, m.targetValue)})` : ''}. ` : '')
  const celebrate = useCelebrate()
  const finish = (result: 'won' | 'lost') =>
    start(async () => {
      const { xp } = await finishExperiment(e.id, result, learning)
      if (xp) celebrate({ xp, levelUp: null, badges: [] })
    })
  return (
    <article className="card stack-s draft experiment">
      <div className="row between">
        <span className="row" style={{ gap: '0.35rem' }}>
          <span className="chip accent">{e.channel}</span>
          <span className="chip" title={`Impact ${e.impact} · zekerheid ${e.confidence} · gemak ${e.ease}`}>
            Kansrijk <span className="num">{String(e.ice).replace('.', ',')}</span> van 10
          </span>
          {e.cost ? <span className="chip">{e.cost}</span> : null}
        </span>
        {e.status === 'done' ? <span className={`chip ${e.result === 'won' ? 'good' : 'bad'}`}>{e.result === 'won' ? 'Werkte' : 'Werkte niet'}</span> : null}
      </div>
      <p className="draft-subject">{e.title}</p>
      <p className="small">{e.hypothesis}</p>
      <ol className="small stack-xs">
        {e.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="tiny muted">
        <strong>Meet:</strong> {e.metric} · <strong>doel:</strong> {e.target}
      </p>
      {m && m.startedOn ? (
        <div className="measured row between">
          <span className="small">
            {m.label}: <strong className="num">{fmt(m.key, m.baseline)}</strong> → <strong className="num">{fmt(m.key, m.actual)}</strong>
            {m.targetValue != null ? <span className="muted"> · doel {fmt(m.key, m.targetValue)}</span> : null}
          </span>
          {e.status === 'planned' ? <span className="chip">{m.daysLeft ? `nog ${m.daysLeft} ${m.daysLeft === 1 ? 'dag' : 'dagen'}` : 'meten!'}</span> : null}
        </div>
      ) : m && e.status === 'draft' ? (
        <p className="tiny muted">Gemeten met {m.label.toLowerCase()}{m.targetValue != null ? `, doel ${fmt(m.key, m.targetValue)}` : ''}.</p>
      ) : null}
      {e.status === 'done' && e.learning ? <p className="small">💡 {e.learning}</p> : null}
      {e.status === 'draft' ? (
        <button type="button" className="button primary small" disabled={pending} onClick={() => start(() => startExperiment(e.id))} style={{ alignSelf: 'start' }}>
          <Icon name="bolt" size={16} /> Start dit experiment
        </button>
      ) : null}
      {e.status === 'planned' && !finishing ? (
        <button type="button" className="button secondary small" onClick={() => setFinishing(true)} style={{ alignSelf: 'start' }}>
          <Icon name="check" size={16} /> Afronden
        </button>
      ) : null}
      {e.status === 'planned' && finishing ? (
        <div className="stack-s">
          <label className="field">
            <span className="tiny">Wat heb je geleerd?</span>
            <input className="input" value={learning} onChange={(ev) => setLearning(ev.target.value)} maxLength={400} placeholder="Bijv. 12 aanmeldingen, vooral via de bieb" />
          </label>
          {m?.suggestion ? (
            <p className="tiny muted">
              De cijfers zeggen: <strong>{m.suggestion === 'won' ? 'het werkte' : 'het werkte (nog) niet'}</strong>. Andere dingen bewegen cijfers ook; jij beslist.
            </p>
          ) : null}
          <div className="row">
            <button type="button" className={`button small ${m?.suggestion === 'lost' ? 'secondary' : 'xp'}`} disabled={pending} onClick={() => finish('won')}>
              Het werkte
            </button>
            <button type="button" className={`button small ${m?.suggestion === 'lost' ? 'xp' : 'secondary'}`} disabled={pending} onClick={() => finish('lost')}>
              Het werkte niet
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
