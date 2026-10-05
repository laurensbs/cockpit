'use client'

import { useState, useTransition } from 'react'
import { setKeepAwake } from '@/server/actions/claude'

/** On by default: while the cockpit is open and on mains power, the computer does not go to sleep. */
export function KeepAwakeToggle({ on }: { on: boolean }) {
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
          start(() => setKeepAwake(next))
        }}
      />
      <span className="stack-xs">
        <strong>Wakker blijven aan de stroom</strong>
        <span className="tiny muted">Zolang de cockpit openstaat en je computer aan de stroom zit, gaat hij niet slapen. Het scherm mag wel uit. Op de accu slaapt hij gewoon.</span>
      </span>
    </label>
  )
}
