'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Icon } from './Icon'

/** Runs the daily round now: GitHub, sites, quests. */
export function UpdateNowButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [summary, setSummary] = useState('')
  return (
    <div className="stack-xs">
      <button
        type="button"
        className="button secondary small"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy')
          try {
            const res = await fetch('/api/daily', { method: 'POST' })
            if (!res.ok) throw new Error(String(res.status))
            const body = (await res.json()) as { github: { synced: number; failed: number; left: number } }
            setSummary(`${body.github.synced} repo’s gelezen${body.github.failed ? `, ${body.github.failed} mislukt` : ''}.`)
            setState('done')
            router.refresh()
          } catch {
            setState('error')
          }
        }}
      >
        <Icon name="branch" size={16} /> {state === 'busy' ? 'Bezig met bijwerken…' : 'Nu bijwerken'}
      </button>
      <p className="tiny muted">Bij het starten en daarna elke twaalf uur leest de cockpit GitHub, controleert hij je sites en maakt hij de quests van de dag.</p>
      {state === 'done' ? (
        <p className="tiny" role="status">
          Bijgewerkt: {summary}
        </p>
      ) : null}
      {state === 'error' ? (
        <p className="notice bad small" role="alert">
          Bijwerken lukte niet.
        </p>
      ) : null}
    </div>
  )
}
