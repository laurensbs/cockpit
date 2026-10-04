'use client'

import { formatEuro } from '@/lib/time'
import { useForm } from '@/lib/use-form'
import { saveDeal } from '@/server/actions/contacts'
import { initialFormState } from '@/server/actions/types'

/** What the deal is worth and what happens next, for a contact that answered. */
export function DealFields({ contactId, value, period, nextStep, nextStepOn, today }: { contactId: string; value: number | null; period: string | null; nextStep: string; nextStepOn: string | null; today: string }) {
  const { state, pending, onSubmit } = useForm(saveDeal, initialFormState)
  const late = nextStepOn != null && nextStepOn < today
  const summary = [value != null ? `${formatEuro(value)}${period === 'month' ? ' per maand' : ''}` : null, nextStep ? `${nextStep}${nextStepOn ? ` (${nextStepOn})` : ''}` : null].filter(Boolean).join(' · ')
  return (
    <details className="deal">
      <summary className="small">
        <strong>Deal</strong> <span className={late ? 'deal-late' : 'muted'}>{summary || 'waarde en volgende stap'}</span>
      </summary>
      <form className="stack-s" onSubmit={onSubmit} style={{ marginTop: '0.6rem' }}>
        <input type="hidden" name="contactId" value={contactId} />
        <div className="grid tight">
          <label className="field">
            <span className="tiny">Waarde (€)</span>
            <input className="input num" name="value" inputMode="decimal" defaultValue={value ?? ''} />
          </label>
          <label className="field">
            <span className="tiny">Per</span>
            <select className="select" name="period" defaultValue={period ?? 'month'}>
              <option value="month">maand (abonnement)</option>
              <option value="once">eenmalig</option>
            </select>
          </label>
          <label className="field">
            <span className="tiny">Volgende stap</span>
            <input className="input" name="nextStep" maxLength={160} placeholder="Offerte sturen" defaultValue={nextStep} />
          </label>
          <label className="field">
            <span className="tiny">Wanneer</span>
            <input className="input" type="date" name="nextStepOn" defaultValue={nextStepOn ?? ''} />
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
    </details>
  )
}
