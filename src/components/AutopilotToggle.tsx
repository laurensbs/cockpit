'use client'

import { useState, useTransition } from 'react'
import { setAutopilot } from '@/server/actions/claude'

/** Opt-in: Claude Code makes the weekly focus on Monday morning, and on working days a post about what he built. */
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
        <strong>Autopilot: Claude werkt vooruit</strong>
        <span className="tiny muted">Elke maandag de weekfocus, en elke werkdag per project een post klaar (Instagram eerst). Op de achtergrond, zolang de cockpit openstaat. Telt mee in je Claude-limieten.</span>
      </span>
    </label>
  )
}
