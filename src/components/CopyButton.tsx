'use client'

import { useState } from 'react'
import { Icon } from './Icon'

/** Copies text to the clipboard; where the browser refuses, it says so instead of pretending. */
export function CopyButton({ text, label = 'Kopieer' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  return (
    <button
      type="button"
      className="button secondary small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState('done')
        } catch {
          setState('failed')
        }
        setTimeout(() => setState('idle'), 1800)
      }}
    >
      <Icon name={state === 'done' ? 'check' : 'copy'} size={16} /> {state === 'done' ? 'Gekopieerd' : state === 'failed' ? 'Selecteer en kopieer zelf' : label}
    </button>
  )
}
