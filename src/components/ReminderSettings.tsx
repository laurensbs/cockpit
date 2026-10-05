'use client'

import { useState, useTransition } from 'react'
import { saveReminder } from '@/server/actions/settings'

/** The daily nudge: on or off, at what time, with or without a sound. */
export function ReminderSettings({ time, sound }: { time: string; sound: boolean }) {
  const [on, setOn] = useState(Boolean(time))
  const [clock, setClock] = useState(time || '09:00')
  const [withSound, setWithSound] = useState(sound)
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const save = (next: { on?: boolean; clock?: string; sound?: boolean }) =>
    start(async () => {
      const r = await saveReminder(next.on ?? on, next.clock ?? clock, next.sound ?? withSound)
      setMessage({ ok: r.ok, text: r.message })
    })
  return (
    <div className="stack-s" aria-label="Dagelijkse herinnering">
      <label className="check">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            setOn(e.target.checked)
            save({ on: e.target.checked })
          }}
        />
        <span className="stack-xs">
          <strong>Dagelijkse herinnering</strong>
          <span className="tiny muted">Op werkdagen één seintje van je Mac als je dagdoel nog open staat. Een klik opent je les. Werkt zolang Cockpit draait (ook met het venster dicht).</span>
        </span>
      </label>
      {on ? (
        <div className="row" style={{ paddingLeft: '2rem' }}>
          <label className="row nowrap small">
            Om
            <input
              className="input"
              type="time"
              aria-label="Tijd van de herinnering"
              value={clock}
              disabled={pending}
              onChange={(e) => setClock(e.target.value)}
              onBlur={() => save({})}
              style={{ width: 'auto', minHeight: 40 }}
            />
          </label>
          <label className="check small">
            <input
              type="checkbox"
              checked={withSound}
              disabled={pending}
              onChange={(e) => {
                setWithSound(e.target.checked)
                save({ sound: e.target.checked })
              }}
            />
            <span>Met geluid</span>
          </label>
        </div>
      ) : null}
      {message ? (
        <span className="tiny" role={message.ok ? 'status' : 'alert'} style={message.ok ? undefined : { color: 'var(--bad)' }}>
          {message.text}
        </span>
      ) : null}
    </div>
  )
}
