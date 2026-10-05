'use client'

import { useState, useTransition } from 'react'
import { useForm } from '@/lib/use-form'
import { pullStatsNow, savePostStats } from '@/server/actions/content-week'
import { initialFormState } from '@/server/actions/types'
import { Icon } from './Icon'

/** "Cijfers ophalen": Instagram and TikTok now, instead of in the daily round. */
export function PullStatsButton() {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <div className="row">
      <button
        type="button"
        className="button secondary small"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await pullStatsNow()
            setMessage({ ok: r.ok, text: r.message })
          })
        }
      >
        <Icon name="refresh" size={16} /> {pending ? 'Bezig…' : 'Cijfers ophalen'}
      </button>
      {message ? (
        <span className="tiny" role="status" style={{ color: message.ok ? 'var(--good)' : 'var(--bad)' }}>
          {message.text}
        </span>
      ) : null}
    </div>
  )
}

const FIELDS = [
  { name: 'views', label: 'Weergaven' },
  { name: 'likes', label: 'Likes' },
  { name: 'comments', label: 'Reacties' },
  { name: 'shares', label: 'Gedeeld' },
  { name: 'saves', label: 'Bewaard' },
] as const

/** The numbers he looked up himself (LinkedIn), and the post's link. */
export function PostStatsForm({ itemId, channel, stats, link }: { itemId: string; channel: string; stats: Record<string, number>; link: string | null }) {
  const { state, pending, onSubmit } = useForm(savePostStats, initialFormState)
  return (
    <form className="stack-s" onSubmit={onSubmit} aria-label="Cijfers van deze post">
      <input type="hidden" name="itemId" value={itemId} />
      <div className="stats-fields">
        {FIELDS.map((f) => (
          <label key={f.name} className="field">
            <span className="tiny">{f.label}</span>
            <input className="input" name={f.name} inputMode="numeric" defaultValue={stats[f.name] ?? ''} autoComplete="off" />
          </label>
        ))}
      </div>
      {channel === 'linkedin' ? <p className="tiny muted">Op LinkedIn: open de post en kies Statistieken. Likes zijn alle reacties (duim, hart…), reacties zijn de opmerkingen, gedeeld zijn de reposts.</p> : null}
      <label className="field">
        <span className="tiny">Link van de post</span>
        <input className="input" name="link" type="url" defaultValue={link ?? ''} placeholder={channel === 'tiktok' ? 'https://www.tiktok.com/@…/video/…' : 'https://…'} />
      </label>
      {channel === 'tiktok' ? <p className="tiny muted">Met de link van je TikTok haalt de cockpit de cijfers daarna zelf op.</p> : null}
      <div className="row">
        <button type="submit" className="button secondary small" disabled={pending}>
          {pending ? 'Bezig…' : 'Bewaren'}
        </button>
        {state.message ? (
          <span className="tiny muted" role="status">
            {state.message}
          </span>
        ) : null}
        {state.error ? (
          <span className="tiny" role="alert" style={{ color: 'var(--bad)' }}>
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  )
}
