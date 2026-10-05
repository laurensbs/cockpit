'use client'

import { useSyncExternalStore } from 'react'
import { SOUND_KEY } from '@/lib/chime'

const EVENT = 'cockpit-sound'
const read = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}

/** Sound in the lesson, on or off, kept on this computer. */
export function SoundToggle() {
  const on = useSyncExternalStore(
    (notify) => {
      window.addEventListener(EVENT, notify)
      return () => window.removeEventListener(EVENT, notify)
    },
    read,
    () => true,
  )
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          try {
            localStorage.setItem(SOUND_KEY, e.target.checked ? '1' : '0')
          } catch {
            // Private mode: stays on.
          }
          window.dispatchEvent(new Event(EVENT))
        }}
      />
      <span className="stack-xs">
        <strong>Geluid tijdens je dag</strong>
        <span className="tiny muted">Een zachte toon bij “goed zo” en aan het eind.</span>
      </span>
    </label>
  )
}
