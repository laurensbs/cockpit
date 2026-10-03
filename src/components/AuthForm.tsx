'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { authClient } from '@/lib/auth-client'
import { Icon } from './Icon'

const ERRORS: Record<string, string> = {
  'not-owner': 'Dit adres heeft geen toegang tot deze cockpit.',
  code: 'Die setup-code klopt niet.',
  rate: 'Even te veel pogingen. Wacht tien seconden en probeer het opnieuw.',
  signin: 'Inloggen lukte niet. Controleer je e-mailadres en wachtwoord.',
  passkey: 'Inloggen met Face ID of vingerafdruk lukte niet.',
  generic: 'Er ging iets mis. Probeer het nog eens.',
}

function errorKey(error: { status?: number; message?: string } | null | undefined, fallback: string): string {
  if (!error) return fallback
  if (error.status === 429) return 'rate'
  if (error.message && error.message in ERRORS) return error.message
  return fallback
}

/** Sign in, or (the very first time) make the owner account with the one-time setup code. */
export function AuthForm({ next, firstTime }: { next: string; firstTime: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<'signin' | 'signup'>(firstTime ? 'signup' : 'signin')
  const [error, setError] = useState<string | null>(null)
  const [welcome, setWelcome] = useState(false)
  const [pending, start] = useTransition()

  function done() {
    router.push(next)
    router.refresh()
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    setError(null)
    start(async () => {
      if (mode === 'signin') {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) return setError(errorKey(error, 'signin'))
        return done()
      }
      const body = { name: String(form.get('name') ?? '').trim() || 'Founder', email, password, setupCode: String(form.get('setupCode') ?? '') }
      const { error } = await authClient.signUp.email(body as Parameters<typeof authClient.signUp.email>[0])
      if (error) return setError(errorKey(error, 'generic'))
      setWelcome(true)
    })
  }

  if (welcome) {
    return (
      <div className="stack-m">
        <p className="notice good">Je cockpit is van jou. Wil je voortaan inloggen met Face ID of je vingerafdruk?</p>
        <button
          type="button"
          className="button primary block"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await authClient.passkey.addPasskey({ name: 'Cockpit' })
              done()
            })
          }
        >
          <Icon name="key" size={18} /> Face ID instellen
        </button>
        <button type="button" className="button ghost block" onClick={done}>
          Later
        </button>
      </div>
    )
  }

  return (
    <div className="stack-m">
      <div className="segmented" role="group" aria-label="Kies">
        <button type="button" aria-pressed={mode === 'signin'} onClick={() => setMode('signin')}>
          Inloggen
        </button>
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>
          Eerste keer
        </button>
      </div>
      <form className="stack-m" onSubmit={submit}>
        {mode === 'signup' ? (
          <label className="field">
            <span>Voornaam</span>
            <input className="input" name="name" autoComplete="given-name" required />
          </label>
        ) : null}
        <label className="field">
          <span>E-mailadres</span>
          <input className="input" name="email" type="email" autoComplete="username webauthn" required />
        </label>
        <label className="field">
          <span>Wachtwoord</span>
          <input
            className="input"
            name="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? 10 : undefined}
            required
          />
          {mode === 'signup' ? <span className="hint">Minstens 10 tekens.</span> : null}
        </label>
        {mode === 'signup' ? (
          <label className="field">
            <span>Setup-code</span>
            <input className="input" name="setupCode" autoComplete="off" autoCapitalize="none" spellCheck={false} required />
            <span className="hint">De eenmalige code die je van Claude kreeg. Zonder code kan niemand anders deze cockpit claimen.</span>
          </label>
        ) : null}
        {error ? (
          <p className="notice bad" role="alert">
            {ERRORS[error] ?? ERRORS.generic}
          </p>
        ) : null}
        <button type="submit" className="button primary block" disabled={pending}>
          {mode === 'signin' ? 'Inloggen' : 'Cockpit claimen'}
        </button>
      </form>
      {mode === 'signin' ? (
        <button
          type="button"
          className="button secondary block"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const result = await authClient.signIn.passkey()
              if (result?.error) return setError(errorKey(result.error, 'passkey'))
              done()
            })
          }
        >
          <Icon name="key" size={18} /> Inloggen met Face ID
        </button>
      ) : null}
    </div>
  )
}
