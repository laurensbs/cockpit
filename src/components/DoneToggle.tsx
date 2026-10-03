'use client'

import { useState, useTransition } from 'react'
import { markContentDone } from '@/server/actions/content'
import { useCelebrate } from './CelebrationProvider'
import { Icon } from './Icon'

/** "Gepost" or "Verstuurd": he did it himself, elsewhere; ticking it gives the XP. */
export function DoneToggle({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [pending, start] = useTransition()
  const [value, setValue] = useState(done)
  const celebrate = useCelebrate()
  return (
    <button
      type="button"
      className={`button small ${value ? 'xp' : 'secondary'}`}
      aria-pressed={value}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !value
          setValue(next)
          const { xp } = await markContentDone(id, next)
          if (xp) celebrate({ xp, levelUp: null, badges: [] })
        })
      }
    >
      <Icon name="check" size={16} /> {label}
    </button>
  )
}
