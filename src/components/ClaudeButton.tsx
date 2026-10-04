'use client'

import type { LaunchResult } from '@/server/actions/claude'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'
import { useClaudeLaunch } from './useClaudeLaunch'

/** What happened after "open Claude Code": opened, done, or the command to paste when no window opened. */
export function LaunchStatus({ launch, done }: { launch: LaunchResult | null; done: boolean }) {
  if (!launch) return null
  if (!launch.ok)
    return (
      <p className="notice bad small" role="alert">
        {launch.error ?? 'Dat lukte niet.'}
      </p>
    )
  if (!launch.launched)
    return (
      <div className="notice small stack-xs" role="status">
        <span>{launch.error ?? 'Kon geen terminal openen.'} Open er zelf een en plak dit:</span>
        <code className="codeblock">{launch.command}</code>
        <CopyButton text={launch.command ?? ''} label="Kopieer het commando" />
      </div>
    )
  return done ? (
    <p className="tiny" role="status">
      Klaar: het staat in de cockpit.
    </p>
  ) : (
    <p className="tiny muted" role="status">
      Claude Code is geopend in een eigen venster. Zodra hij klaar is, verschijnt het hier.
    </p>
  )
}

/**
 * Opens Claude Code with a task. Claude works in its own window, on his own account; the page
 * refreshes when the result lands.
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
  const { open, pending, launch, done } = useClaudeLaunch()
  return (
    <div className="stack-s">
      <button type="button" className={`button ${variant} ai-button`} disabled={pending || Boolean(disabledReason)} onClick={() => void open(task, projectId, options ?? {})}>
        <Icon name="bolt" size={18} />
        {pending ? 'Claude Code openen…' : label}
        <span className="num tiny ai-cost">Claude Code</span>
      </button>
      {disabledReason ? <p className="tiny muted">{disabledReason}</p> : null}
      <LaunchStatus launch={launch} done={done} />
    </div>
  )
}
