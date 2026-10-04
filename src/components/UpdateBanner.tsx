'use client'

import { useState, useTransition } from 'react'
import { runUpdate } from '@/server/actions/update'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'

/** A newer Cockpit is on GitHub: one click opens Terminal, which installs it and reopens the app. */
export function UpdateBanner({ update }: { update: { version: string; notes: string } }) {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; command: string; error?: string } | null>(null)
  return (
    <section className="notice update-banner stack-xs" role="status">
      <div className="row between">
        <span className="row">
          <Icon name="up" size={16} />
          <strong>Cockpit {update.version} staat klaar</strong>
        </span>
        <button type="button" className="button primary small" disabled={pending || Boolean(result?.ok)} onClick={() => start(async () => setResult(await runUpdate()))}>
          {pending ? 'Terminal openen…' : result?.ok ? 'Bezig in Terminal…' : 'Bijwerken'}
        </button>
      </div>
      {update.notes ? <p className="tiny muted">{update.notes}</p> : null}
      {result?.ok ? <p className="tiny muted">Terminal installeert de nieuwe versie, sluit Cockpit en opent hem opnieuw. Je gegevens blijven staan.</p> : null}
      {result && !result.ok ? (
        <div className="stack-xs">
          <p className="tiny">{result.error ?? 'Terminal wilde niet openen.'} Plak dit zelf in Terminal:</p>
          <code className="codeblock">{result.command}</code>
          <CopyButton text={result.command} label="Kopieer de regel" />
        </div>
      ) : null}
    </section>
  )
}
