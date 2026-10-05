'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useForm } from '@/lib/use-form'
import { deleteConnector, pullNow, saveConnector, testConnector } from '@/server/actions/numbers'
import { initialFormState } from '@/server/actions/types'

export interface ConnectorKindView {
  kind: string
  label: string
  delivers: string[]
  fields: { name: string; label: string; placeholder?: string; hint?: string; required: boolean; options?: { value: string; label: string }[] }[]
  secret: { label: string; placeholder: string; hint: string; optional?: boolean } | null
  /** What has to be set up first (the Google service account), if anything. */
  needs: string | null
}

export interface ConnectorView {
  id: string
  kind: string
  label: string
  config: Record<string, string>
  lastOk: string | null
  lastError: string | null
}

/** The connected sources: their state, a test, removing one, and pulling everything now. */
export function ConnectorList({ projectId, connectors }: { projectId: string; connectors: ConnectorView[] }) {
  const [pending, start] = useTransition()
  const [messages, setMessages] = useState<Record<string, { ok: boolean; text: string }>>({})
  const say = (id: string, ok: boolean, text: string) => setMessages((m) => ({ ...m, [id]: { ok, text } }))
  return (
    <div className="stack-s">
      {connectors.length ? (
        <ul className="list" style={{ margin: 0 }}>
          {connectors.map((c) => (
            <li key={c.id} className="stack-xs">
              <div className="row between">
                <span className="row">
                  <strong>{c.label}</strong>
                  {c.lastError ? <span className="chip bad">Fout</span> : c.lastOk ? <span className="chip good">Werkt</span> : <span className="chip">Nog niet opgehaald</span>}
                  {Object.values(c.config).length ? <span className="tiny muted">{Object.values(c.config).join(' · ')}</span> : null}
                </span>
                <span className="row">
                  <button type="button" className="button ghost small" disabled={pending} onClick={() => start(async () => {
                    const r = await testConnector(c.id)
                    say(c.id, r.ok, r.message)
                  })}>
                    Test
                  </button>
                  <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => deleteConnector(c.id))}>
                    Weg
                  </button>
                </span>
              </div>
              {c.lastError ? <p className="tiny" style={{ color: 'var(--bad)' }}>{c.lastError}</p> : c.lastOk ? <p className="tiny muted">Laatst opgehaald: {c.lastOk}</p> : null}
              {messages[c.id] ? (
                <p className="tiny" role="status" style={{ color: messages[c.id].ok ? 'var(--good)' : 'var(--bad)' }}>
                  {messages[c.id].text}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Nog geen bron gekoppeld.</p>
      )}
      {connectors.length ? (
        <div className="row">
          <button type="button" className="button secondary small" disabled={pending} onClick={() => start(async () => {
            const r = await pullNow(projectId)
            say('all', r.ok, r.message)
          })}>
            {pending ? 'Bezig…' : 'Nu ophalen'}
          </button>
          {messages.all ? (
            <span className="tiny" role="status" style={{ color: messages.all.ok ? 'var(--good)' : 'var(--bad)' }}>
              {messages.all.text}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Connect a source: pick it, fill in what it needs, paste a read-only key. */
export function ConnectorForm({ projectId, kinds }: { projectId: string; kinds: ConnectorKindView[] }) {
  const { state, pending, onSubmit } = useForm(saveConnector, initialFormState)
  const [kind, setKind] = useState(kinds[0]?.kind ?? '')
  const current = kinds.find((k) => k.kind === kind)
  return (
    <form className="stack-s" onSubmit={onSubmit} key={kind}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid tight">
        <label className="field">
          <span className="tiny">Bron</span>
          <select className="select" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {current?.fields.map((f) => (
          <label key={f.name} className="field">
            <span className="tiny">{f.label}</span>
            {f.options ? (
              <select className="select" name={f.name} defaultValue={f.options[0]?.value}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input" name={f.name} placeholder={f.placeholder} required={f.required} autoComplete="off" />
            )}
            {f.hint ? <span className="hint">{f.hint}</span> : null}
          </label>
        ))}
        {current?.secret ? (
          <label className="field">
            <span className="tiny">{current.secret.label}</span>
            <input className="input" type="password" name="secret" placeholder={current.secret.placeholder} autoComplete="off" />
            <span className="hint">{current.secret.hint}</span>
          </label>
        ) : null}
      </div>
      {current?.needs ? (
        <p className="notice warn small">
          {current.needs} <Link href="/settings#sources">Naar Instellingen</Link>
        </p>
      ) : null}
      {current ? (
        <p className="tiny muted">
          Levert: {current.delivers.join(', ')}.{current.secret ? ' De sleutel blijft op deze computer en kan alleen lezen.' : ''}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" className="button primary small" disabled={pending}>
          Koppelen
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
