'use client'

import { useTransition } from 'react'
import { assignRepo, removeRepo } from '@/server/actions/repos'

export function RepoAssign({ repoId, projectId, projects }: { repoId: string; projectId: string | null; projects: { id: string; name: string }[] }) {
  const [pending, start] = useTransition()
  return (
    <span className="row nowrap">
      <select
        className="select"
        aria-label="Project"
        defaultValue={projectId ?? ''}
        disabled={pending}
        style={{ minHeight: 36, width: 'auto', maxWidth: 200 }}
        onChange={(e) => {
          const next = e.target.value || null
          start(() => assignRepo(repoId, next))
        }}
      >
        <option value="">Geen project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => removeRepo(repoId))}>
        Weg
      </button>
    </span>
  )
}
