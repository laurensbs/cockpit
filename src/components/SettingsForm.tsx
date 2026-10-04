'use client'

import { useForm } from '@/lib/use-form'
import { saveSettings } from '@/server/actions/settings'
import { initialFormState } from '@/server/actions/types'
import { Icon } from './Icon'

/** The owner's name and the GitHub token; the token never comes back to the page once stored. */
export function SettingsForm({ name, hasToken, status }: { name: string; hasToken: boolean; status: React.ReactNode }) {
  const { state, pending, onSubmit } = useForm(saveSettings, initialFormState)
  return (
    <form className="stack-m" onSubmit={onSubmit}>
      <label className="field">
        <span className="tiny">Hoe heet je?</span>
        <input className="input" name="name" defaultValue={name} maxLength={60} autoComplete="given-name" placeholder="Je voornaam" />
      </label>
      <div className="stack-xs">
        <div className="row between">
          <span className="label">GitHub-token</span>
          {status}
        </div>
        <input
          className="input"
          name="githubToken"
          type="password"
          aria-label="GitHub-token"
          placeholder={hasToken ? 'Ingesteld; plak een nieuwe om te vervangen' : 'github_pat_…'}
          autoComplete="off"
          spellCheck={false}
        />
        {hasToken ? (
          <label className="check small">
            <input type="checkbox" name="clearToken" value="1" />
            <span>Token verwijderen</span>
          </label>
        ) : null}
      </div>
      {state.error ? (
        <p className="notice bad" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="notice" role="status">
          {state.message}
        </p>
      ) : null}
      <button type="submit" className="button primary" disabled={pending}>
        <Icon name="check" size={18} /> {pending ? 'Bezig…' : 'Bewaren'}
      </button>
    </form>
  )
}
