'use client'

import { useState } from 'react'
import { useForm } from '@/lib/use-form'
import { importRepos } from '@/server/actions/repos'
import { initialFormState } from '@/server/actions/types'
import { Icon } from './Icon'

export interface ImportableRepo {
  fullName: string
  description: string
  isPrivate: boolean
  pushedLabel: string
}

/** Pick repositories (suggested groups first) and the project they belong to. */
export function RepoImport({
  groups,
  projects,
  defaultProject,
}: {
  groups: ImportableRepo[][]
  projects: { id: string; name: string }[]
  defaultProject: string
}) {
  const { state, pending, onSubmit } = useForm(importRepos, initialFormState)
  const [count, setCount] = useState(0)
  return (
    <form
      className="stack-m"
      onSubmit={onSubmit}
      onChange={(e) => setCount(e.currentTarget.querySelectorAll('input[name="repo"]:checked').length)}
    >
      {state.message ? (
        <p className="notice good small" role="status">
          {state.message}
        </p>
      ) : null}
      {!groups.length ? <p className="empty">Alles is gekoppeld.</p> : null}
      <div
        className="card stack-s"
        hidden={!groups.length}
        style={{ position: 'sticky', top: 'calc(var(--topbar-h) + env(safe-area-inset-top, 0px) + 8px)', zIndex: 5 }}
      >
        <label className="field">
          <span>Koppel aan</span>
          <select className="select" name="projectId" defaultValue={defaultProject}>
            <option value="">Nog geen project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button primary" disabled={pending || count === 0}>
          <Icon name="branch" size={18} /> {pending ? 'GitHub lezen…' : `${count} repo${count === 1 ? '' : "'s"} koppelen`}
        </button>
        {state.error ? (
          <p className="notice bad small" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
      {groups.map((group) => (
        <ul key={group.map((r) => r.fullName).join()} className={`card list ${group.length > 1 ? 'group' : ''}`}>
          {group.length > 1 ? <p className="eyebrow">Horen waarschijnlijk bij elkaar</p> : null}
          {group.map((r) => (
            <li key={r.fullName}>
              <label className="check">
                <input type="checkbox" name="repo" value={r.fullName} />
                <span className="stack-xs grow" style={{ minWidth: 0 }}>
                  <span className="row between">
                    <strong style={{ overflowWrap: 'anywhere' }}>{r.fullName.split('/')[1]}</strong>
                    <span className="tiny faint">{r.pushedLabel}</span>
                  </span>
                  {r.description ? <span className="small muted">{r.description}</span> : null}
                  {r.isPrivate ? null : <span className="chip" style={{ width: 'fit-content' }}>openbaar</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      ))}
    </form>
  )
}
