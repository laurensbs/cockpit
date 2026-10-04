'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cancelMail, retryMail, runOutboxNow } from '@/server/actions/mail'
import { Icon } from './Icon'

export function OutboxActions({ id, sequenceId, status, step }: { id: string; sequenceId: string; status: string; step: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  if (status === 'failed')
    return (
      <button type="button" className="button ghost small" disabled={pending} onClick={() => start(async () => (await retryMail(id), router.refresh()))}>
        Opnieuw
      </button>
    )
  if ((status === 'queued' || status === 'waiting') && step === 0)
    return (
      <button type="button" className="button ghost small" disabled={pending} onClick={() => start(async () => (await cancelMail(sequenceId), router.refresh()))}>
        Stoppen
      </button>
    )
  if (status === 'queued' && step > 0)
    return (
      <button type="button" className="button ghost small" disabled={pending} onClick={() => start(async () => (await cancelMail(sequenceId), router.refresh()))}>
        Opvolging stoppen
      </button>
    )
  return null
}

const SKIPPED: Record<string, string> = {
  'not-configured': 'Mailbox nog niet ingesteld.',
  paused: 'Automatisch versturen staat uit.',
  window: 'Buiten kantoortijd: morgen vanaf 9 uur.',
  cap: 'De limiet van vandaag is bereikt.',
}

/** Sends what is due now, instead of waiting for the next round. */
export function RunOutboxButton() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState('')
  return (
    <span className="row nowrap">
      {message ? (
        <span className="tiny" role="status">
          {message}
        </span>
      ) : null}
      <button
        type="button"
        className="button secondary small"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runOutboxNow()
            setMessage(r.skipped ? SKIPPED[r.skipped] ?? '' : r.sent || r.failed ? `${r.sent} verstuurd${r.failed ? `, ${r.failed} mislukt` : ''}.` : 'Niets te versturen.')
            router.refresh()
          })
        }
      >
        <Icon name="send" size={14} /> Nu versturen
      </button>
    </span>
  )
}
