'use client'

import { METRIC_DEFS, METRIC_KEYS } from '@/lib/metrics'
import { useForm } from '@/lib/use-form'
import { savePoint } from '@/server/actions/numbers'
import { initialFormState } from '@/server/actions/types'

/** One number on one day, typed in: it counts over every source for that day. */
export function PointForm({ projectId, today, defaultKey }: { projectId: string; today: string; defaultKey: string }) {
  const { state, pending, onSubmit } = useForm(savePoint, initialFormState)
  return (
    <form className="stack-s" onSubmit={onSubmit}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid tight">
        <label className="field">
          <span className="tiny">Cijfer</span>
          <select className="select" name="key" defaultValue={defaultKey}>
            {METRIC_KEYS.map((k) => (
              <option key={k} value={k}>
                {METRIC_DEFS[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="tiny">Dag</span>
          <input className="input" type="date" name="day" defaultValue={today} max={today} required />
        </label>
        <label className="field">
          <span className="tiny">Waarde</span>
          <input className="input num" name="value" inputMode="decimal" required placeholder="0" />
        </label>
      </div>
      <div className="row">
        <button type="submit" className="button secondary small" disabled={pending}>
          Bewaren
        </button>
        {state.message ? (
          <span className="tiny muted" role="status">
            {state.message}
          </span>
        ) : null}
        {state.error ? (
          <span className="tiny" style={{ color: 'var(--bad)' }} role="alert">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  )
}
