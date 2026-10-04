'use client'

import { useState, useTransition } from 'react'
import { setAutopilot } from '@/server/actions/claude'

/** Opt-in: Claude Code makes the weekly focus by itself on Monday morning. */
export function AutopilotToggle({ on }: { on: boolean }) {
  const [value, setValue] = useState(on)
  const [pending, start] = useTransition()
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked
          setValue(next)
          start(() => setAutopilot(next))
        }}
      />
      <span className="stack-xs">
        <strong>Autopilot: elke maandagochtend de weekfocus</strong>
        <span className="tiny muted">Claude Code maakt hem dan zelf, op de achtergrond, zodra de cockpit openstaat. Dat telt mee in je Claude-limieten.</span>
      </span>
    </label>
  )
}
