'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { openInClaude, type LaunchResult } from '@/server/actions/claude'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'

const WATCH_MS = 20 * 60_000

/**
 * Opens Claude Code with a task. Claude works in its own window, on his own account; this watches
 * the cockpit for the result and refreshes the page when it lands.
 */
export function ClaudeButton({
  task,
  projectId,
  options,
  label,
  variant = 'primary',
  disabledReason,
}: {
  task: string
  projectId: string | null
  options?: Record<string, unknown>
  label: string
  variant?: 'primary' | 'secondary'
  disabledReason?: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [launch, setLaunch] = useState<LaunchResult | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!launch?.ok || done) return
    let since: string | null = null
    let stopped = false
    const started = Date.now()
    const look = async () => {
      if (stopped) return
      try {
        const res = await fetch('/api/changes', { cache: 'no-store' })
        if (!res.ok) return
        const { latest } = (await res.json()) as { latest: string | null }
        if (since === null) since = latest ?? ''
        else if ((latest ?? '') !== since) {
          stopped = true
          setDone(true)
          router.refresh()
        }
      } catch {
        // A missed look is fine; the next one tries again.
      }
    }
    void look()
    const timer = setInterval(() => {
      if (Date.now() - started > WATCH_MS) stopped = true
      if (stopped) clearInterval(timer)
      else void look()
    }, 4000)
    window.addEventListener('focus', look)
    return () => {
      stopped = true
      clearInterval(timer)
      window.removeEventListener('focus', look)
    }
  }, [launch, done, router])

  return (
    <div className="stack-s">
      <button
        type="button"
        className={`button ${variant} ai-button`}
        disabled={pending || Boolean(disabledReason)}
        onClick={() =>
          start(async () => {
            setDone(false)
            setLaunch(await openInClaude(task, projectId, options ?? {}))
          })
        }
      >
        <Icon name="bolt" size={18} />
        {pending ? 'Claude Code openen…' : label}
        <span className="num tiny ai-cost">Claude Code</span>
      </button>
      {disabledReason ? <p className="tiny muted">{disabledReason}</p> : null}
      {launch && !launch.ok ? (
        <p className="notice bad small" role="alert">
          {launch.error ?? 'Dat lukte niet.'}
        </p>
      ) : null}
      {launch?.ok && launch.launched && !done ? (
        <p className="tiny muted" role="status">
          Claude Code is geopend in een eigen venster. Zodra hij klaar is, verschijnt het hier.
        </p>
      ) : null}
      {launch?.ok && !launch.launched ? (
        <div className="notice small stack-xs" role="status">
          <span>{launch.error ?? 'Kon geen terminal openen.'} Open er zelf een en plak dit:</span>
          <code className="codeblock">{launch.command}</code>
          <CopyButton text={launch.command ?? ''} label="Kopieer het commando" />
        </div>
      ) : null}
      {done ? (
        <p className="tiny" role="status">
          Klaar: het staat in de cockpit.
        </p>
      ) : null}
    </div>
  )
}
