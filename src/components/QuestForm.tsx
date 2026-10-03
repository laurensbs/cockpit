'use client'

import { useState } from 'react'
import { QUEST_XP } from '@/lib/game'
import { RECURRENCES, RECURRENCE_LABELS } from '@/lib/quests'
import { useForm } from '@/lib/use-form'
import { saveQuest } from '@/server/actions/quests'
import { initialFormState } from '@/server/actions/types'

export function QuestForm({ projects, projectId }: { projects: { id: string; name: string }[]; projectId?: string }) {
  const { state, pending, onSubmit } = useForm(saveQuest, initialFormState)
  const [boss, setBoss] = useState(false)
  return (
    <form className="stack-m" onSubmit={onSubmit}>
      <label className="field">
        <span>Quest</span>
        <input className="input" name="title" required minLength={2} maxLength={160} placeholder="Bijv. btw-aangifte Q4, of 3 opvangen bellen" />
      </label>
      <label className="field">
        <span>Toelichting</span>
        <input className="input" name="detail" maxLength={1000} />
      </label>
      <div className="grid tight">
        {projectId ? (
          <input type="hidden" name="projectId" value={projectId} />
        ) : (
          <label className="field">
            <span>Project</span>
            <select className="select" name="projectId" defaultValue="">
              <option value="">Algemeen</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>XP</span>
          <select className="select" name="xp" defaultValue="25" disabled={boss}>
            {QUEST_XP.map((x) => (
              <option key={x} value={x}>
                {x} XP
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Wanneer</span>
          <input className="input" type="date" name="dueOn" />
        </label>
        <label className="field">
          <span>Herhalen</span>
          <select className="select" name="recurrence" defaultValue="none">
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="boss" checked={boss} onChange={(e) => setBoss(e.target.checked)} />
        <span>
          <strong>Boss-quest</strong> <span className="small muted">— het grote ding van deze week, 250 XP</span>
        </span>
      </label>
      <div className="row">
        <button type="submit" className="button primary" disabled={pending}>
          Quest toevoegen
        </button>
        {state.message ? (
          <span className="small muted" role="status">
            {state.message}
          </span>
        ) : null}
        {state.error ? (
          <span className="small" style={{ color: 'var(--bad)' }} role="alert">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  )
}
