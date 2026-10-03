'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { formatUsdMicros } from '@/lib/time'
import { startAi } from '@/server/actions/ai'
import { Icon } from './Icon'

const THINKING = ['Leest je intake en repo’s…', 'Zoekt waar je doelgroep zit…', 'Weegt kanalen af…', 'Denkt buiten de lijntjes…', 'Maakt het concreet…']

interface RunState {
  status: string
  error: string | null
  costMicros: number
}

/**
 * Starts an AI job and follows it: Claude works on the server after the click, this polls until it
 * is done and then refreshes the page. Shows what it will roughly cost before, and what it did after.
 */
export function AiButton({
  kind,
  projectId,
  label,
  estimateMicros,
  disabledReason,
  variant = 'primary',
}: {
  kind: string
  projectId: string
  label: string
  estimateMicros: number
  disabledReason?: string | null
  variant?: 'primary' | 'secondary'
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [runId, setRunId] = useState<string | null>(null)
  const [state, setState] = useState<RunState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (!runId) return
    let stopped = false
    const started = Date.now()
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai/runs/${runId}`, { cache: 'no-store' })
        if (!res.ok || stopped) return
        const run = (await res.json()) as RunState
        if (run.status === 'running') return
        stopped = true
        clearInterval(poll)
        clearInterval(tick)
        setState(run)
        setRunId(null)
        if (run.status === 'done') router.refresh()
      } catch {
        // A missed poll is fine; the next one tries again.
      }
    }, 2000)
    return () => {
      stopped = true
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [runId, router])

  const busy = pending || runId !== null
  return (
    <div className="stack-s">
      <button
        type="button"
        className={`button ${variant} ai-button${busy ? ' busy' : ''}`}
        disabled={busy || Boolean(disabledReason)}
        onClick={() =>
          start(async () => {
            setError(null)
            setState(null)
            setSeconds(0)
            const result = await startAi(kind, projectId)
            if (result.error) setError(result.error)
            else if (result.runId) setRunId(result.runId)
          })
        }
      >
        <Icon name="studio" size={18} />
        {busy ? THINKING[Math.floor(seconds / 6) % THINKING.length] : label}
        {busy ? <span className="num tiny">{seconds}s</span> : <span className="num tiny ai-cost">± {formatUsdMicros(estimateMicros)}</span>}
      </button>
      {disabledReason ? <p className="tiny muted">{disabledReason}</p> : null}
      {error ? (
        <p className="notice bad small" role="alert">
          {error}
        </p>
      ) : null}
      {state?.status === 'done' ? (
        <p className="tiny muted" role="status">
          Klaar · kostte {formatUsdMicros(state.costMicros)}
        </p>
      ) : null}
      {state && state.status !== 'done' ? (
        <p className="notice bad small" role="alert">
          {state.error ?? 'Dat lukte niet.'} {state.costMicros ? `(kostte ${formatUsdMicros(state.costMicros)})` : ''}
        </p>
      ) : null}
    </div>
  )
}
