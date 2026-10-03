'use client'

import { useState, useTransition } from 'react'

/** A destructive button that asks once more on the page itself (no browser dialog). */
export function ConfirmButton({ action, label, confirm }: { action: () => Promise<void>; label: string; confirm: string }) {
  const [asking, setAsking] = useState(false)
  const [pending, start] = useTransition()
  if (!asking) {
    return (
      <button type="button" className="button danger small" onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }
  return (
    <div className="row">
      <span className="small">{confirm}</span>
      <button type="button" className="button danger small" disabled={pending} onClick={() => start(() => action())}>
        Ja, verwijderen
      </button>
      <button type="button" className="button ghost small" onClick={() => setAsking(false)}>
        Nee
      </button>
    </div>
  )
}
