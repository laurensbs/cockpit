'use client'

import { METRIC_KEYS, METRIC_LABELS } from '@/lib/options'
import { useForm } from '@/lib/use-form'
import { saveMetric } from '@/server/actions/companies'
import { initialFormState } from '@/server/actions/types'

/** Enter one number for one month; the same project, month and kind again replaces it. */
export function MetricForm({ projects, month }: { projects: { id: string; name: string }[]; month: string }) {
  const { state, pending, onSubmit } = useForm(saveMetric, initialFormState)
  if (!projects.length) return null
  return (
    <form className="stack-s" onSubmit={onSubmit}>
      <div className="grid tight">
        {projects.length > 1 ? (
          <label className="field">
            <span className="tiny">Project</span>
            <select className="select" name="projectId" required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="projectId" value={projects[0].id} />
        )}
        <label className="field">
          <span className="tiny">Maand</span>
          <input className="input" type="month" name="month" defaultValue={month} required />
        </label>
        <label className="field">
          <span className="tiny">Wat</span>
          <select className="select" name="key" defaultValue="revenue">
            {METRIC_KEYS.map((k) => (
              <option key={k} value={k}>
                {METRIC_LABELS[k]}
              </option>
            ))}
          </select>
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
