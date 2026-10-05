'use client'

import { useState, useTransition } from 'react'
import { retryBackgroundToday } from '@/server/actions/claude'

/** Claude Code logged itself out, so the background work stopped: say so, plainly, with the fix. */
export function ClaudeLoggedOut() {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  return (
    <section className="notice bad stack-s" aria-label="Claude Code is uitgelogd">
      <strong>Claude Code is uitgelogd, dus Claude werkt nu niet voor je</strong>
      <ol className="small" style={{ margin: 0, paddingLeft: '1.2rem' }}>
        <li>Open Terminal en typ <code>claude</code></li>
        <li>Typ <code>/login</code> en log in met je Claude-account</li>
      </ol>
      <div className="row">
        <button type="button" className="button primary" disabled={pending} onClick={() => start(async () => setMessage((await retryBackgroundToday()).message))}>
          Ik ben ingelogd, probeer opnieuw
        </button>
        {message ? (
          <span className="small" role="status">
            {message}
          </span>
        ) : null}
      </div>
    </section>
  )
}
