'use client'

import { useState, useTransition } from 'react'
import { useForm } from '@/lib/use-form'
import { pullNow, saveGoogleAccount } from '@/server/actions/numbers'
import { initialFormState } from '@/server/actions/types'
import { Icon } from './Icon'

/** The Google service account: paste the key file once; afterwards only its e-mail address shows. */
export function GoogleAccountForm({ email }: { email: string | null }) {
  const { state, pending, onSubmit } = useForm(saveGoogleAccount, initialFormState)
  return (
    <form className="stack-s" onSubmit={onSubmit} key={state.ok ? state.message : 'form'}>
      {email ? (
        <p className="small">
          Gekoppeld als <code>{email}</code>
        </p>
      ) : null}
      <label className="field">
        <span className="tiny">{email ? 'Ander sleutelbestand (JSON)' : 'Sleutelbestand (JSON)'}</span>
        <textarea className="textarea" name="account" rows={4} spellCheck={false} autoComplete="off" placeholder='{ "type": "service_account", "client_email": "…", "private_key": "…" }' style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
      </label>
      <div className="row">
        <button type="submit" className="button primary small" disabled={pending}>
          <Icon name="key" size={16} /> {pending ? 'Bezig…' : 'Bewaren'}
        </button>
        {email ? (
          <button type="submit" name="remove" value="1" className="button ghost small" disabled={pending}>
            Verwijderen
          </button>
        ) : null}
        {state.error ? (
          <span className="tiny" style={{ color: 'var(--bad)' }} role="alert">
            {state.error}
          </span>
        ) : state.message ? (
          <span className="tiny muted" role="status">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  )
}

/** "Alles nu ophalen": every source of every project, right away. */
export function PullAllButton() {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <div className="row">
      <button type="button" className="button secondary small" disabled={pending} onClick={() => start(async () => {
        const r = await pullNow()
        setMessage({ ok: r.ok, text: r.message })
      })}>
        <Icon name="refresh" size={16} /> {pending ? 'Bezig…' : 'Alles nu ophalen'}
      </button>
      {message ? (
        <span className="tiny" role="status" style={{ color: message.ok ? 'var(--good)' : 'var(--bad)' }}>
          {message.text}
        </span>
      ) : null}
    </div>
  )
}
