'use client'

import { useTransition } from 'react'
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS } from '@/lib/options'
import { deleteContact, setContactStatus } from '@/server/actions/contacts'
import { useCelebrate } from './CelebrationProvider'

export function ContactStatus({ contactId, status }: { contactId: string; status: string }) {
  const [pending, start] = useTransition()
  const celebrate = useCelebrate()
  return (
    <span className="row nowrap">
      <select
        className="select"
        aria-label="Status"
        defaultValue={status}
        disabled={pending}
        style={{ minHeight: 36, width: 'auto' }}
        onChange={(e) => {
          const next = e.target.value
          start(async () => {
            const { xp } = await setContactStatus(contactId, next)
            if (xp) celebrate({ xp, levelUp: null, badges: [] })
          })
        }}
      >
        {CONTACT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CONTACT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => deleteContact(contactId))}>
        Weg
      </button>
    </span>
  )
}
