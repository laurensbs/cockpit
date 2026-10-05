'use client'

import { useEffect, useRef } from 'react'
import { useForm } from '@/lib/use-form'
import { importContacts } from '@/server/actions/contacts'
import { initialFormState } from '@/server/actions/types'

const EXAMPLE = 'Garage Voorbeeld;;info@voorbeeld.nl;voorbeeld.nl;zakelijk;Palamós, werkplaats voor campers'

/** Many contacts at once: a pasted list (from a spreadsheet or a text file), one contact per line. */
export function ContactImport({ projectId }: { projectId: string }) {
  const { state, pending, onSubmit } = useForm(importContacts, initialFormState)
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok) form.current?.reset()
  }, [state])
  return (
    <details className="stack-s">
      <summary className="small">
        <strong>Plak een lijst</strong> <span className="muted">meerdere contacten tegelijk</span>
      </summary>
      <form ref={form} className="stack-s" onSubmit={onSubmit}>
        <input type="hidden" name="projectId" value={projectId} />
        <p className="tiny muted">
          Eén contact per regel, in de volgorde van het formulier: organisatie; naam; e-mail; website; basis (zakelijk, relatie of toestemming); notitie.
          Kolommen uit een spreadsheet (tabs) werken ook. Wat er al staat, wordt overgeslagen. De adressen blijven in de cockpit.
        </p>
        <textarea className="textarea" name="list" rows={6} placeholder={EXAMPLE} spellCheck={false} aria-label="Lijst met contacten" />
        <div className="row">
          <button type="submit" className="button secondary" disabled={pending}>
            Contacten toevoegen
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
    </details>
  )
}
