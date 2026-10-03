'use client'

import { useTransition } from 'react'
import { removeRepo, setRepoInAi } from '@/server/actions/repos'
import { Icon } from './Icon'

export interface RepoItem {
  id: string
  fullName: string
  isPrivate: boolean
  archived: boolean
  stack: string[]
  includeInAi: boolean
  syncError: string | null
  syncedLabel: string
}

function RepoRow({ repo }: { repo: RepoItem }) {
  const [pending, start] = useTransition()
  return (
    <li className="stack-s">
      <div className="row between">
        <a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noreferrer noopener" className="row nowrap" style={{ fontWeight: 650 }}>
          <Icon name="branch" size={16} /> {repo.fullName}
        </a>
        <span className="tiny muted">{repo.syncedLabel}</span>
      </div>
      {repo.stack.length ? (
        <div className="row">
          {repo.stack.slice(0, 8).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {repo.syncError ? <p className="notice warn small">{repo.syncError}</p> : null}
      <div className="row between">
        <label className="check small">
          <input type="checkbox" defaultChecked={repo.includeInAi} disabled={pending} onChange={(e) => start(() => setRepoInAi(repo.id, e.target.checked))} />
          <span>README en docs mee naar de AI</span>
        </label>
        <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => removeRepo(repo.id))}>
          Ontkoppelen
        </button>
      </div>
    </li>
  )
}

export function RepoList({ repos }: { repos: RepoItem[] }) {
  return (
    <ul className="list">
      {repos.map((r) => (
        <RepoRow key={r.id} repo={r} />
      ))}
    </ul>
  )
}
