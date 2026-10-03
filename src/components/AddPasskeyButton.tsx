'use client'

import { useState, useTransition } from 'react'
import { authClient } from '@/lib/auth-client'
import { Icon } from './Icon'

export function AddPasskeyButton() {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <div className="stack-s">
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await authClient.passkey.addPasskey({ name: 'Cockpit' })
            setMessage(result?.error ? { ok: false, text: 'Dat lukte niet. Probeer het nog eens.' } : { ok: true, text: 'Toegevoegd.' })
          })
        }
      >
        <Icon name="key" size={18} /> Face ID toevoegen
      </button>
      {message ? (
        <p className={`notice ${message.ok ? 'good' : 'bad'} small`} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
