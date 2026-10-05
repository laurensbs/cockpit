'use client'

import { useState, useTransition } from 'react'
import type { ContentChannel, ContentFormat } from '@/lib/ai/playbooks'
import { BRAND_FONTS, BRAND_STYLES, type Brand } from '@/lib/brand'
import type { ReelPlan, Slide } from '@/lib/content-week'
import { useForm } from '@/lib/use-form'
import { approveItem, approveWeek, markPosted, redrawItem, saveBrandAndRhythm, saveItemText, skipItem, unapproveItem } from '@/server/actions/content-week'
import { initialFormState } from '@/server/actions/types'
import { useCelebrate } from './CelebrationProvider'
import { LaunchStatus } from './ClaudeButton'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'
import { useClaudeLaunch } from './useClaudeLaunch'

export interface WeekItemView {
  id: string
  project: string
  channel: ContentChannel
  channelLabel: string
  format: ContentFormat
  formatLabel: string
  day: string
  time: string
  status: string
  title: string
  hook: string
  caption: string
  hashtags: string[]
  slides: Slide[]
  reel: ReelPlan | null
  forum: { place: string; url: string; answer: string; disclosure: string } | null
  goal: string | null
  why: string
  render: 'pending' | 'done' | 'failed' | null
  renderError: string | null
  images: { id: string; url: string }[]
  pdf: string | null
}

const STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: 'Goedgekeurd', tone: 'good' },
  done: { label: 'Geplaatst', tone: 'good' },
}

/** The full text he publishes: caption plus hashtags, or the forum answer with its disclaimer. */
const publishText = (item: WeekItemView) =>
  item.forum ? [item.forum.answer, item.forum.disclosure].filter(Boolean).join('\n\n') : [item.caption, item.hashtags.join(' ')].filter(Boolean).join('\n\n')

/** One post, carousel, video or forum answer of the content week. */
export function WeekItemCard({ item }: { item: WeekItemView }) {
  const [pending, start] = useTransition()
  const celebrate = useCelebrate()
  const status = STATUS[item.status]
  const posted = (fn: () => Promise<{ xp: number }>) =>
    start(async () => {
      const { xp } = await fn()
      if (xp) celebrate({ xp, levelUp: null, badges: [] })
    })
  return (
    <article className="card stack-s week-card" data-status={item.status}>
      <div className="row between">
        <span className="row" style={{ gap: '0.35rem' }}>
          <span className="chip accent">{item.channelLabel}</span>
          <span className="chip">{item.formatLabel}</span>
          <span className="chip">{item.project}</span>
        </span>
        <span className="row" style={{ gap: '0.35rem' }}>
          <span className="tiny muted num">{item.time}</span>
          {status ? <span className={`chip ${status.tone}`}>{status.label}</span> : null}
        </span>
      </div>

      {item.images.length ? (
        <div className="slides-strip" role="list" aria-label={`Beelden van ${item.title}`}>
          {item.images.map((img, i) => (
            // Local media from the cockpit's own folder; next/image would try to optimize it with sharp.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.url} alt={item.slides[i]?.title ?? item.reel?.coverText ?? item.title} role="listitem" loading="lazy" className={item.format === 'reel' || item.format === 'story' ? 'tall' : ''} />
          ))}
        </div>
      ) : item.render === 'pending' ? (
        <p className="tiny muted">De beelden worden getekend…</p>
      ) : item.render === 'failed' ? (
        <div className="row">
          <span className="tiny" style={{ color: 'var(--bad)' }}>Tekenen lukte niet{item.renderError ? `: ${item.renderError}` : ''}.</span>
          <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => redrawItem(item.id))}>
            Opnieuw tekenen
          </button>
        </div>
      ) : null}

      <p className="draft-subject">{item.hook || item.title}</p>
      {item.forum ? (
        <div className="stack-xs">
          <p className="small">
            <strong>{item.forum.place}</strong> ·{' '}
            <a href={item.forum.url} target="_blank" rel="noreferrer">
              open de plek
            </a>
          </p>
          <p className="small pre">{item.forum.answer}</p>
          {item.forum.disclosure ? <p className="tiny muted">{item.forum.disclosure}</p> : null}
        </div>
      ) : (
        <details>
          <summary className="small">{item.caption.slice(0, 140)}{item.caption.length > 140 ? '…' : ''}</summary>
          <p className="small pre">{item.caption}</p>
          {item.hashtags.length ? <p className="tiny muted">{item.hashtags.join(' ')}</p> : null}
        </details>
      )}
      {item.reel ? (
        <details>
          <summary className="tiny">Script: {item.reel.beats.length} beats, {item.reel.durationSec} s</summary>
          <ol className="tiny stack-xs">
            {item.reel.beats.map((b) => (
              <li key={`${b.sec}-${b.text}`}>
                <span className="num">{b.sec}s</span> {b.text}
                {b.shot ? <span className="muted"> · {b.shot}</span> : null}
              </li>
            ))}
          </ol>
          {item.reel.voiceover ? <p className="tiny pre">Voice-over: {item.reel.voiceover}</p> : null}
        </details>
      ) : null}
      {item.why ? <p className="tiny muted">{item.why}</p> : null}

      {item.status === 'draft' && !item.forum ? (
        <div className="row">
          <button type="button" className="button primary small" disabled={pending || item.render === 'pending'} onClick={() => start(() => approveItem(item.id))}>
            <Icon name="check" size={16} /> Goedkeuren
          </button>
          <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => skipItem(item.id))}>
            Overslaan
          </button>
        </div>
      ) : null}
      {item.status === 'approved' || (item.forum && item.status === 'draft') ? (
        <div className="row">
          <CopyButton text={publishText(item)} label={item.forum ? 'Kopieer antwoord' : 'Kopieer tekst'} />
          {item.pdf ? (
            <a className="button secondary small" href={`${item.pdf}?download=1&name=${encodeURIComponent(`${item.title}.pdf`)}`}>
              PDF
            </a>
          ) : null}
          {item.images.length && !item.pdf ? (
            <a className="button secondary small" href={`${item.images[0].url}?download=1&name=${encodeURIComponent(`${item.title} 1.png`)}`}>
              Beeld{item.images.length > 1 ? ` 1 van ${item.images.length}` : ''}
            </a>
          ) : null}
          <button type="button" className="button xp small" disabled={pending} onClick={() => posted(() => markPosted(item.id))}>
            Geplaatst
          </button>
          {item.status === 'approved' ? (
            <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => unapproveItem(item.id))}>
              Terug naar concept
            </button>
          ) : (
            <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => skipItem(item.id))}>
              Overslaan
            </button>
          )}
        </div>
      ) : null}
      {item.status !== 'done' ? <ItemTools item={item} /> : null}
    </article>
  )
}

/** Change the text or the slides, or let Claude make a better version. */
function ItemTools({ item }: { item: WeekItemView }) {
  const { state, pending, onSubmit } = useForm(saveItemText, initialFormState)
  const claude = useClaudeLaunch()
  const [note, setNote] = useState('')
  return (
    <details>
      <summary className="tiny">Aanpassen of opnieuw laten maken</summary>
      <div className="stack-m" style={{ marginTop: '0.6rem' }}>
        <form className="stack-s" onSubmit={onSubmit}>
          <input type="hidden" name="itemId" value={item.id} />
          {item.forum ? (
            <label className="field">
              <span className="tiny">Antwoord</span>
              <textarea className="textarea" name="answer" rows={6} defaultValue={item.forum.answer} />
            </label>
          ) : (
            <>
              <label className="field">
                <span className="tiny">Hook (eerste regel)</span>
                <input className="input" name="hook" defaultValue={item.hook} maxLength={220} />
              </label>
              <label className="field">
                <span className="tiny">Tekst</span>
                <textarea className="textarea" name="caption" rows={6} defaultValue={item.caption} />
              </label>
            </>
          )}
          {item.slides.map((slide, i) => (
            <div key={`${item.id}-${i}`} className="grid tight">
              <label className="field">
                <span className="tiny">Dia {i + 1}: titel</span>
                <input className="input" name={`slide-${i}-title`} defaultValue={slide.title} maxLength={90} />
              </label>
              <label className="field">
                <span className="tiny">Dia {i + 1}: tekst</span>
                <input className="input" name={`slide-${i}-body`} defaultValue={slide.body} maxLength={220} />
              </label>
            </div>
          ))}
          {item.reel ? (
            <label className="field">
              <span className="tiny">Tekst op de cover</span>
              <input className="input" name="coverText" defaultValue={item.reel.coverText} maxLength={60} />
            </label>
          ) : null}
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
        <div className="stack-s">
          <label className="field">
            <span className="tiny">Wat moet er beter? (Claude maakt een nieuwe versie)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Bijv. korter, en meer over de prijs" />
          </label>
          <button type="button" className="button secondary small ai-button" disabled={claude.pending} onClick={() => void claude.open('content', null, { itemId: item.id, note })} style={{ alignSelf: 'start' }}>
            <Icon name="bolt" size={16} /> Opnieuw laten maken
          </button>
          <LaunchStatus launch={claude.launch} done={claude.done} />
        </div>
      </div>
    </details>
  )
}

/** Approve every draft whose pictures are ready, in one go. */
export function ApproveWeekButton({ count }: { count: number }) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState('')
  if (!count && !message) return null
  return (
    <div className="row">
      {count ? (
        <button type="button" className="button primary" disabled={pending} onClick={() => start(async () => {
          const { approved } = await approveWeek()
          setMessage(`${approved} goedgekeurd.`)
        })}>
          <Icon name="check" size={18} /> Week goedkeuren ({count})
        </button>
      ) : null}
      {message ? (
        <span className="tiny muted" role="status">
          {message}
        </span>
      ) : null}
    </div>
  )
}

const RHYTHM_LABELS: Record<ContentChannel, string> = { linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', forum: 'Forums' }

/** A project's house style and how often it posts per channel, with a sample slide. */
export function BrandRhythmForm({ projectId, name, brand, rhythm }: { projectId: string; name: string; brand: Brand; rhythm: Record<ContentChannel, number> }) {
  const { state, pending, onSubmit } = useForm(saveBrandAndRhythm, initialFormState)
  const [draft, setDraft] = useState(brand)
  const field = (key: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }))
  const preview = `/api/render/preview?${new URLSearchParams({ project: projectId, accent: draft.accent, bg: draft.bg, fg: draft.fg, font: draft.font, style: draft.style, handle: draft.handle }).toString()}`
  return (
    <form className="brand-form" onSubmit={onSubmit} aria-label={`Huisstijl en ritme van ${name}`}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="stack-s">
        <div className="grid tight">
          <label className="field">
            <span className="tiny">Accentkleur</span>
            <input className="input color" type="color" name="accent" defaultValue={brand.accent} onChange={field('accent')} />
          </label>
          <label className="field">
            <span className="tiny">Achtergrond</span>
            <input className="input color" type="color" name="bg" defaultValue={brand.bg} onChange={field('bg')} />
          </label>
          <label className="field">
            <span className="tiny">Tekst</span>
            <input className="input color" type="color" name="fg" defaultValue={brand.fg} onChange={field('fg')} />
          </label>
        </div>
        <div className="grid tight">
          <label className="field">
            <span className="tiny">Letters</span>
            <select className="select" name="font" defaultValue={brand.font} onChange={field('font')}>
              {Object.entries(BRAND_FONTS).map(([k, f]) => (
                <option key={k} value={k}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="tiny">Stijl</span>
            <select className="select" name="style" defaultValue={brand.style} onChange={field('style')}>
              {Object.entries(BRAND_STYLES).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="tiny">Handle op de beelden</span>
            <input className="input" name="handle" defaultValue={brand.handle} placeholder="@jouwaccount" maxLength={31} onChange={field('handle')} />
          </label>
        </div>
        <fieldset className="stack-xs" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="tiny">Per week</legend>
          <div className="grid tight">
            {(Object.keys(RHYTHM_LABELS) as ContentChannel[]).map((c) => (
              <label key={c} className="field">
                <span className="tiny">{RHYTHM_LABELS[c]}</span>
                <input className="input" type="number" name={`rhythm-${c}`} min={0} max={7} defaultValue={rhythm[c]} />
              </label>
            ))}
          </div>
          <span className="hint">LinkedIn is je eigen profiel: samen nooit meer dan vijf per week, één per dag.</span>
        </fieldset>
        <div className="row">
          <button type="submit" className="button secondary small" disabled={pending}>
            {pending ? 'Bezig…' : 'Bewaren'}
          </button>
          {state.message ? (
            <span className="tiny muted" role="status">
              {state.message}
            </span>
          ) : null}
        </div>
      </div>
      {/* A sample drawn on request, never cached. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-preview" src={preview} alt={`Voorbeeld in de huisstijl van ${name}`} width={216} height={270} />
    </form>
  )
}
