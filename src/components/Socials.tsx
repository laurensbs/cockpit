'use client'

import { useState, useTransition } from 'react'
import { SOCIALS, type SocialKey } from '@/lib/socials'
import { saveSocial } from '@/server/actions/projects'

/** One chip per platform: linked opens the profile, not linked asks for the link. */
export function Socials({ projectId, linked }: { projectId: string; linked: Partial<Record<SocialKey, string>> }) {
  const [editing, setEditing] = useState<SocialKey | null>(null)
  const [value, setValue] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const label = editing ? SOCIALS.find((x) => x.key === editing)?.label : ''
  return (
    <div className="stack-xs" aria-label="Socials">
      <div className="row" style={{ gap: '0.4rem' }}>
        {SOCIALS.map((x) =>
          linked[x.key] ? (
            <a key={x.key} className="chip good" href={linked[x.key]} target="_blank" rel="noreferrer noopener" title={linked[x.key]}>
              ✓ {x.label}
            </a>
          ) : (
            <button
              key={x.key}
              type="button"
              className="chip"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setEditing(x.key)
                setValue('')
                setMessage(null)
              }}
            >
              + {x.label}
            </button>
          ),
        )}
      </div>
      {editing ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await saveSocial(projectId, editing, value)
              setMessage({ ok: r.ok, text: r.message })
              if (r.ok) setEditing(null)
            })
          }}
        >
          <input className="input" autoFocus aria-label={`Link naar je ${label}`} placeholder={`Plak je ${label}-link`} value={value} onChange={(e) => setValue(e.target.value)} style={{ maxWidth: 340 }} />
          <button type="submit" className="button primary small" disabled={pending || !value.trim()}>
            Koppel
          </button>
          <button type="button" className="button ghost small" onClick={() => setEditing(null)}>
            Annuleer
          </button>
        </form>
      ) : null}
      {message ? (
        <span className="tiny" role={message.ok ? 'status' : 'alert'} style={message.ok ? undefined : { color: 'var(--bad)' }}>
          {message.text}
        </span>
      ) : null}
    </div>
  )
}
