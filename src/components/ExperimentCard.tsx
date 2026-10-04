'use client'

import { useState, useTransition } from 'react'
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
}

/** One experiment on the board: start it, then say whether it worked and what you learned. */
export function ExperimentCard({ experiment: e }: { experiment: ExperimentView }) {
  const [pending, start] = useTransition()
  const [finishing, setFinishing] = useState(false)
  const [learning, setLearning] = useState('')
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
            ICE <span className="num">{e.ice}</span>
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
          <div className="row">
            <button type="button" className="button xp small" disabled={pending} onClick={() => finish('won')}>
              Het werkte
            </button>
            <button type="button" className="button secondary small" disabled={pending} onClick={() => finish('lost')}>
              Het werkte niet
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}
