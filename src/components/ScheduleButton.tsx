'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { scheduleAllDrafts, scheduleEmail } from '@/server/actions/mail'
import { Icon } from './Icon'

/** He approves a mail once: it (and its follow-ups) goes out on its own. */
export function ScheduleButton({ contentItemId, label = 'Goedkeuren en inplannen' }: { contentItemId: string; label?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  return (
    <span className="stack-xs">
      <button
        type="button"
        className="button primary small"
        disabled={pending || result?.ok}
        onClick={() =>
          start(async () => {
            const r = await scheduleEmail(contentItemId)
            setResult(r)
            if (r.ok) router.refresh()
          })
        }
      >
        <Icon name="send" size={16} /> {pending ? 'Inplannen…' : label}
      </button>
      {result ? (
        <span className={`tiny ${result.ok ? '' : 'notice bad'}`} role={result.ok ? 'status' : 'alert'}>
          {result.message}
        </span>
      ) : null}
    </span>
  )
}

/** Every ready personal draft of the project in the queue, with one approval. */
export function ScheduleAllButton({ projectId, count }: { projectId: string; count: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  return (
    <span className="stack-xs">
      <button
        type="button"
        className="button secondary"
        disabled={pending || count === 0}
        onClick={() =>
          start(async () => {
            const r = await scheduleAllDrafts(projectId)
            setResult(r)
            if (r.ok) router.refresh()
          })
        }
      >
        <Icon name="check" size={16} /> {pending ? 'Inplannen…' : `Keur ${count} concept${count === 1 ? '' : 'en'} goed en plan in`}
      </button>
      {result ? (
        <span className={`tiny ${result.ok ? '' : 'notice bad'}`} role={result.ok ? 'status' : 'alert'}>
          {result.message}
        </span>
      ) : null}
    </span>
  )
}
