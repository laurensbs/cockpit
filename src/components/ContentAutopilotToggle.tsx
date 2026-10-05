'use client'

import { useState, useTransition } from 'react'
import { setContentAutopilot } from '@/server/actions/claude'

/** Opt-in: Claude Code makes the content week by itself on Monday morning; he approves it. */
export function ContentAutopilotToggle({ on }: { on: boolean }) {
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
          start(() => setContentAutopilot(next))
        }}
      />
      <span className="stack-xs">
        <strong>Contentweek: elke maandagochtend automatisch</strong>
        <span className="tiny muted">Claude Code maakt de posts, carrousels, video-scripts en forumantwoorden voor al je projecten; jij keurt ze goed onder Contentweek. Dat telt mee in je Claude-limieten.</span>
      </span>
    </label>
  )
}
