'use client'

import { useState, useTransition } from 'react'
import { archiveContent, rateContent } from '@/server/actions/content'
import { Icon } from './Icon'

/** Thumbs (they steer the next round) and archive, the same on every draft. */
export function ContentActions({ id, rating, archived }: { id: string; rating: number; archived: boolean }) {
  const [pending, start] = useTransition()
  const [value, setValue] = useState(rating)
  const rate = (v: number) =>
    start(async () => {
      const next = value === v ? 0 : v
      setValue(next)
      await rateContent(id, next)
    })
  return (
    <span className="row nowrap" style={{ gap: '0.25rem' }}>
      <button type="button" className={`icon-button${value > 0 ? ' on' : ''}`} aria-pressed={value > 0} aria-label="Goed idee" disabled={pending} onClick={() => rate(1)} style={{ width: 34, height: 34 }}>
        <Icon name="up" size={15} />
      </button>
      <button type="button" className={`icon-button${value < 0 ? ' on' : ''}`} aria-pressed={value < 0} aria-label="Niet voor mij" disabled={pending} onClick={() => rate(-1)} style={{ width: 34, height: 34 }}>
        <Icon name="down" size={15} />
      </button>
      <button type="button" className="icon-button" aria-label={archived ? 'Terughalen' : 'Archiveren'} title={archived ? 'Terughalen' : 'Archiveren'} disabled={pending} onClick={() => start(() => archiveContent(id, !archived))} style={{ width: 34, height: 34 }}>
        <Icon name={archived ? 'refresh' : 'archive'} size={15} />
      </button>
    </span>
  )
}
