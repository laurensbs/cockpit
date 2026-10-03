'use client'

import { CONTACT_BASIS_LABELS } from '@/lib/options'
import { useForm } from '@/lib/use-form'
import { saveContact } from '@/server/actions/contacts'
import { initialFormState } from '@/server/actions/types'

export function ContactForm({ projectId }: { projectId: string }) {
  const { state, pending, onSubmit } = useForm(saveContact, initialFormState)
  return (
    <form className="stack-m" onSubmit={onSubmit}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid tight">
        <label className="field">
          <span>Organisatie</span>
          <input className="input" name="organization" required maxLength={120} />
        </label>
        <label className="field">
          <span>Naam (optioneel)</span>
          <input className="input" name="name" maxLength={80} />
        </label>
        <label className="field">
          <span>Zakelijk e-mailadres</span>
          <input className="input" name="email" type="email" maxLength={160} placeholder="info@…" />
        </label>
        <label className="field">
          <span>Website</span>
          <input className="input" name="website" maxLength={300} inputMode="url" />
        </label>
      </div>
      <label className="field">
        <span>Waarom mag je mailen?</span>
        <select className="select" name="basis" defaultValue="business">
          {Object.entries(CONTACT_BASIS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Notitie</span>
        <input className="input" name="note" maxLength={1000} placeholder="Wat weet je van ze? Waarom passen ze?" />
      </label>
      <div className="row">
        <button type="submit" className="button primary" disabled={pending}>
          Contact toevoegen
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
