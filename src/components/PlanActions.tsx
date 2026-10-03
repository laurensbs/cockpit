'use client'

import { useState, useTransition } from 'react'
import { EFFORT_LABELS, type Plan } from '@/lib/ai/schemas'
import { acceptPlanActions } from '@/server/actions/ai'
import { Icon } from './Icon'

const PHASE_TITLES = { '30': 'Dag 1–30', '60': 'Dag 31–60', '90': 'Dag 61–90' }

/** The plan, with a checkbox per action: the chosen ones become quests in their own week. */
export function PlanActions({ briefId, plan, accepted }: { briefId: string; plan: Plan; accepted: string[] }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const done = new Set(accepted)
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div className="stack-m">
      {plan.phases.map((phase) => (
        <section key={phase.label} className="stack-s">
          <div className="row between">
            <h3>{PHASE_TITLES[phase.label]}</h3>
            <span className="tiny muted">{phase.focus}</span>
          </div>
          <ul className="list" style={{ margin: 0 }}>
            {phase.actions.map((a) => (
              <li key={a.id}>
                <label className="check">
                  <input type="checkbox" disabled={done.has(a.id)} checked={done.has(a.id) || chosen.has(a.id)} onChange={() => toggle(a.id)} aria-label={a.title} />
                  <span className="stack-xs grow" style={{ minWidth: 0 }}>
                    <strong style={{ overflowWrap: 'anywhere' }}>{a.title}</strong>
                    <span className="tiny muted">{a.why}</span>
                    <span className="row" style={{ gap: '0.35rem' }}>
                      <span className="chip">week {a.week}</span>
                      <span className="chip">{a.channel}</span>
                      <span className="chip">{EFFORT_LABELS[a.effort]}</span>
                      <span className="chip xp num">+{a.xp} XP</span>
                      {done.has(a.id) ? <span className="chip good">quest</span> : null}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="row">
        <button
          type="button"
          className="button primary"
          disabled={pending || chosen.size === 0}
          onClick={() =>
            start(async () => {
              const { added } = await acceptPlanActions(briefId, [...chosen])
              setChosen(new Set())
              setMessage(`${added} quest${added === 1 ? '' : 's'} toegevoegd.`)
            })
          }
        >
          <Icon name="quests" size={18} /> {chosen.size ? `${chosen.size} als quest zetten` : 'Kies acties voor je quests'}
        </button>
        {message ? (
          <span className="small muted" role="status">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  )
}
