'use client'

import { useState, useTransition } from 'react'
import { syncRepos } from '@/server/actions/repos'
import { Icon } from './Icon'

/** Reads GitHub again (one project, or everything) and says how it went. */
export function SyncButton({ projectId, label = 'Verversen' }: { projectId?: string; label?: string }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<string | null>(null)
  return (
    <span className="row">
      <button
        type="button"
        className="button secondary small"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncRepos(projectId)
            setResult(r.failed ? `${r.failed} mislukt` : r.left ? `nog ${r.left} te gaan` : 'Bijgewerkt')
          })
        }
      >
        <Icon name="refresh" size={16} /> {pending ? 'Bezig…' : label}
      </button>
      {result ? (
        <span className="tiny muted" role="status">
          {result}
        </span>
      ) : null}
    </span>
  )
}
