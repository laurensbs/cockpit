'use client'

import type { GrowthModel } from '@/lib/growth-model'
import { METRIC_DEFS, METRIC_KEYS } from '@/lib/metrics'
import { useForm } from '@/lib/use-form'
import { saveModel } from '@/server/actions/model'
import { initialFormState } from '@/server/actions/types'

/** The growth model by hand: the target, the deadline, and up to five funnel stages with the conversion he expects. */
export function GrowthModelForm({ projectId, model, defaultDeadline }: { projectId: string; model: GrowthModel | null; defaultDeadline: string }) {
  const { state, pending, onSubmit } = useForm(saveModel, initialFormState)
  const stages = [0, 1, 2, 3, 4].map((i) => model?.funnel[i] ?? null)
  return (
    <form className="stack-m" onSubmit={onSubmit}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid tight">
        <label className="field">
          <span className="tiny">Doelcijfer</span>
          <select className="select" name="key" defaultValue={model?.northStar.key ?? 'mrr'}>
            {METRIC_KEYS.map((k) => (
              <option key={k} value={k}>
                {METRIC_DEFS[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="tiny">Doel (een stand, of per 30 dagen)</span>
          <input className="input num" name="target" inputMode="decimal" required defaultValue={model?.northStar.target ?? ''} />
        </label>
        <label className="field">
          <span className="tiny">Deadline</span>
          <input className="input" type="date" name="deadline" required defaultValue={model?.northStar.deadline ?? defaultDeadline} />
        </label>
        <label className="field">
          <span className="tiny">Waarde per deal (€, optioneel)</span>
          <input className="input num" name="valuePerDeal" inputMode="decimal" defaultValue={model?.valuePerDeal ?? ''} />
        </label>
      </div>
      <fieldset className="stack-xs funnel-fields">
        <legend className="label">Trechter, van boven naar het doel</legend>
        {stages.map((st, i) => (
          <div key={i} className="row nowrap funnel-field">
            <span className="tiny muted num">{i + 1}</span>
            <label className="sr-only" htmlFor={`stage${i}`}>
              Trap {i + 1}
            </label>
            <select id={`stage${i}`} className="select" name={`stage${i}`} defaultValue={st?.key ?? ''}>
              <option value="">{i < 2 ? 'Kies…' : '—'}</option>
              {METRIC_KEYS.map((k) => (
                <option key={k} value={k}>
                  {METRIC_DEFS[k].label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`label${i}`}>
              Naam van trap {i + 1}
            </label>
            <input id={`label${i}`} className="input" name={`label${i}`} placeholder="Naam (optioneel)" maxLength={40} defaultValue={st?.label ?? ''} />
            {i > 0 ? (
              <>
                <label className="sr-only" htmlFor={`rate${i}`}>
                  Verwachte conversie naar trap {i + 1} (%)
                </label>
                <input id={`rate${i}`} className="input num" name={`rate${i}`} inputMode="decimal" placeholder="%" style={{ maxWidth: 90 }} defaultValue={st?.rate != null ? Math.round(st.rate * 1000) / 10 : ''} />
              </>
            ) : (
              <span style={{ width: 90, flex: 'none' }} />
            )}
          </div>
        ))}
        <p className="tiny muted">Het percentage is de conversie die je verwacht vanaf de trap erboven. Leeg mag; dan vergelijkt de cockpit met de weken ervoor.</p>
      </fieldset>
      <label className="field">
        <span className="tiny">Waarom dit doel (optioneel)</span>
        <textarea className="textarea" name="note" rows={2} maxLength={400} defaultValue={model?.note ?? ''} />
      </label>
      <div className="row">
        <button type="submit" className="button primary small" disabled={pending}>
          Groeimodel bewaren
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
