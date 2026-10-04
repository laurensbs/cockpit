'use client'

import { useState, useTransition } from 'react'
import { connectClaude } from '@/server/actions/claude'
import { Icon } from './Icon'

/** Registers the cockpit with Claude Code on this computer, with one press. */
export function ConnectClaudeButton({ connectedAt }: { connectedAt: string | null }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  return (
    <div className="stack-xs">
      <button type="button" className={`button ${connectedAt ? 'secondary' : 'primary'} small`} disabled={pending} onClick={() => start(async () => setResult(await connectClaude()))}>
        <Icon name="bolt" size={16} /> {pending ? 'Bezig…' : connectedAt ? 'Opnieuw koppelen' : 'Koppel aan Claude Code'}
      </button>
      {connectedAt && !result ? <p className="tiny muted">Gekoppeld op {new Date(connectedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.</p> : null}
      {result ? (
        <p className={`notice small ${result.ok ? '' : 'bad'}`} role={result.ok ? 'status' : 'alert'}>
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
