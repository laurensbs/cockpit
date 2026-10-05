'use client'

import { useState, useTransition } from 'react'
import { useForm } from '@/lib/use-form'
import { discoverNow, savePlausibleKey, saveVercelToken, undoDiscovered } from '@/server/actions/discover'
import { initialFormState } from '@/server/actions/types'
import { Icon } from './Icon'

/** An owner-wide key that lets the cockpit link every project by itself: paste once, never shown again. */
export function OwnerKeyForm({ what, set, from }: { what: 'vercel' | 'plausible'; set: boolean; from?: 'settings' | 'cli' | null }) {
  const { state, pending, onSubmit } = useForm(what === 'vercel' ? saveVercelToken : savePlausibleKey, initialFormState)
  const label = what === 'vercel' ? 'Vercel-token' : 'Plausible-sleutel'
  return (
    <form className="stack-s" onSubmit={onSubmit} key={state.ok ? state.message : 'form'} aria-label={label}>
      <label className="field">
        <span className="tiny">{set ? `Ander${what === 'vercel' ? ' token' : 'e sleutel'}` : label}</span>
        <input className="input" type="password" name={what === 'vercel' ? 'token' : 'key'} autoComplete="off" spellCheck={false} placeholder={set ? 'Bewaard; laat leeg om te houden' : '…'} />
      </label>
      <div className="row">
        <button type="submit" className="button primary small" disabled={pending}>
          <Icon name="key" size={16} /> {pending ? 'Bezig met koppelen…' : 'Bewaren'}
        </button>
        {set && from !== 'cli' ? (
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

/** "Zoek koppelingen": look again now, for one project or for all. */
export function DiscoverButton({ projectId, label = 'Zoek koppelingen' }: { projectId?: string; label?: string }) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  return (
    <span className="row">
      <button
        type="button"
        className="button secondary small"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage((await discoverNow(projectId)).message)
          })
        }
      >
        <Icon name="search" size={16} /> {pending ? 'Bezig met zoeken…' : label}
      </button>
      {message ? (
        <span className="tiny muted" role="status">
          {message}
        </span>
      ) : null}
    </span>
  )
}

/** Undo something the cockpit linked by itself; it then stays off. */
export function UndoFoundButton({ projectId, kind }: { projectId: string; kind: string }) {
  const [pending, start] = useTransition()
  return (
    <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => undoDiscovered(projectId, kind))}>
      Ongedaan maken
    </button>
  )
}
