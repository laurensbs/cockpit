'use client'

import { Check, CircleDashed, CircleHelp, RefreshCw } from 'lucide-react'
import { useState, useTransition } from 'react'
import { costOf } from '@/lib/costs'
import { SETUP_GROUPS, type SetupGroup, type SetupStatus } from '@/lib/setup'
import { recheckSetup, setSetupStatus } from '@/server/actions/setup'

/** One step as the page gets it (the catalogue's functions stay on the server). */
export interface SetupStepView {
  key: string
  group: SetupGroup
  title: string
  why: string
  steps: string[]
  who: 'jij' | 'claude' | 'samen'
  cost: string | null
  legal: boolean
  status: SetupStatus
  source: 'jij' | 'auto' | 'claude' | null
  note: string
}

const WHO: Record<SetupStepView['who'], string> = { jij: 'Jij', claude: 'Claude doet het', samen: 'Samen met Claude' }
const SOURCE: Record<NonNullable<SetupStepView['source']>, string> = { jij: 'door jou', auto: 'gecontroleerd', claude: 'volgens Claude' }

function Mark({ status }: { status: SetupStatus }) {
  if (status === 'done')
    return (
      <span className="setup-mark done" aria-label="Geregeld">
        <Check size={16} strokeWidth={3.5} />
      </span>
    )
  if (status === 'todo')
    return (
      <span className="setup-mark todo" aria-label="Nog te doen">
        <CircleDashed size={18} strokeWidth={2.5} />
      </span>
    )
  return (
    <span className="setup-mark unknown" aria-label="Nog niet bekend">
      <CircleHelp size={18} strokeWidth={2.5} />
    </span>
  )
}

function Step({ projectId, step, open }: { projectId: string; step: SetupStepView; open?: boolean }) {
  const [pending, start] = useTransition()
  const [status, setStatus] = useState(step.status)
  const [own, setOwn] = useState(step.source === 'jij')
  const cost = costOf(step.cost)
  const set = (next: SetupStatus | null) =>
    start(async () => {
      const r = await setSetupStatus(projectId, step.key, next)
      if (r.ok) {
        setStatus(next ?? step.status)
        setOwn(next !== null)
      }
    })
  return (
    <li className={`setup-step ${status}`} aria-label={step.title}>
      <Mark status={status} />
      <div className="grow stack-xs" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: '0.4rem' }}>
          <strong>{step.title}</strong>
          {cost && status !== 'done' ? <span className={`chip${cost.amount > 0 ? ' warn' : ''}`}>{cost.text}</span> : null}
          {step.legal && status !== 'done' ? <span className="chip">laat checken</span> : null}
        </div>
        {step.note ? (
          <span className="tiny muted">
            {step.note}
            {step.source ? ` · ${SOURCE[step.source]}` : ''}
          </span>
        ) : null}
        {status !== 'done' ? (
          <details open={open}>
            <summary className="small">Waarom en hoe · {WHO[step.who]}</summary>
            <div className="stack-xs" style={{ marginTop: '0.5rem' }}>
              <p className="small">{step.why}</p>
              <ol className="small setup-how">
                {step.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {cost ? <p className="tiny muted">{cost.note}</p> : null}
            </div>
          </details>
        ) : null}
        <div className="row" style={{ gap: '0.4rem' }}>
          {status !== 'done' ? (
            <button type="button" className="button secondary small" disabled={pending} onClick={() => set('done')}>
              Gedaan
            </button>
          ) : null}
          {status !== 'done' ? (
            <button type="button" className="button ghost small" disabled={pending} onClick={() => set('na')}>
              Niet nodig
            </button>
          ) : null}
          {own ? (
            <button type="button" className="button ghost small" disabled={pending} onClick={() => set(null)}>
              Ongedaan
            </button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/** "Klaar om te groeien": what this business still needs, the next step on top, the rest per theme. */
export function SetupCard({ projectId, steps, next }: { projectId: string; steps: SetupStepView[]; next: string | null }) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const done = steps.filter((s) => s.status === 'done').length
  const groups = (Object.keys(SETUP_GROUPS) as SetupGroup[]).map((g) => ({ g, items: steps.filter((s) => s.group === g && s.key !== next) })).filter((x) => x.items.length)
  const nextStep = steps.find((s) => s.key === next) ?? null
  return (
    <section className="card stack-m" aria-labelledby="setup-title">
      <div className="row between nowrap">
        <div className="stack-xs">
          <h2 id="setup-title">Klaar om te groeien</h2>
          <span className="tiny muted">
            {done} van {steps.length} geregeld · Cockpit controleert dit elke dag zelf
          </span>
        </div>
        <span className="setup-count num" aria-hidden="true">
          {done}/{steps.length}
        </span>
      </div>
      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Hoeveel er geregeld is">
        <span style={{ width: `${steps.length ? Math.round((done / steps.length) * 100) : 0}%` }} />
      </div>
      {nextStep ? (
        <div className="setup-next stack-s">
          <p className="eyebrow">Nu het belangrijkste</p>
          <ul className="setup-list">
            <Step projectId={projectId} step={nextStep} open />
          </ul>
        </div>
      ) : null}
      {groups.map(({ g, items }) => (
        <div key={g} className="stack-xs">
          <p className="eyebrow">{SETUP_GROUPS[g]}</p>
          <ul className="setup-list">
            {items.map((s) => (
              <Step key={s.key} projectId={projectId} step={s} />
            ))}
          </ul>
        </div>
      ))}
      <div className="row">
        <button
          type="button"
          className="button ghost small"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMessage('Bezig met controleren…')
              setMessage((await recheckSetup(projectId)).message)
            })
          }
        >
          <RefreshCw size={16} strokeWidth={2.5} aria-hidden="true" /> Nu controleren
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
