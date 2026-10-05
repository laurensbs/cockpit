'use client'

import { useTransition } from 'react'
import { isPillar, PILLAR_LABEL } from '@/lib/ai/craft'
import { shareUrl } from '@/lib/share'
import { planContent } from '@/server/actions/content'
import { ContentActions } from './ContentActions'
import { CopyButton } from './CopyButton'
import { DoneToggle } from './DoneToggle'
import { PlatformBadge } from './PlatformBadge'

export interface PostView {
  id: string
  title: string
  platform: string
  format: string
  hook: string
  caption: string
  hashtags: string[]
  visualBrief: string
  bestTime: string
  status: string
  plannedFor: string | null
  rating: number
  projectName: string | null
  /** What it is for, what the viewer gets, and the detail only he can say (from the craft rules). */
  pillar?: string | null
  value?: string
  proof?: string
}

/** Meta's own planner (Instagram and Facebook): it posts at the time he picks; the cockpit never posts itself. */
export const META_PLANNER = 'https://business.facebook.com/latest/content_calendar'

const PLATFORM_LABELS: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X/Threads', discord: 'Discord' }

/** A post ready to copy: hook, caption and hashtags, a brief for the visual, and a day to post it. */
export function PostCard({ post }: { post: PostView }) {
  const [pending, start] = useTransition()
  const copy = [post.caption, post.hashtags.join(' ')].filter(Boolean).join('\n\n')
  const share = shareUrl(post.platform, copy)
  return (
    <article className="card stack-s draft">
      <div className="row between">
        <span className="row" style={{ gap: '0.35rem' }}>
          <PlatformBadge platform={post.platform} label={PLATFORM_LABELS[post.platform]} />
          <span className="chip">{post.format}</span>
          {post.pillar && isPillar(post.pillar) ? <span className="chip accent">{PILLAR_LABEL[post.pillar]}</span> : null}
        </span>
        {post.projectName ? <span className="tiny faint">{post.projectName}</span> : null}
      </div>
      <p className="draft-subject">{post.hook}</p>
      {post.value ? (
        <p className="tiny muted">
          <strong>Waarom dit werkt:</strong> {post.value}
          {post.proof ? ` · Echt van jou: ${post.proof}` : ''}
        </p>
      ) : null}
      <p className="prewrap small">{post.caption}</p>
      {post.hashtags.length ? <p className="small" style={{ color: 'var(--accent-ink)' }}>{post.hashtags.join(' ')}</p> : null}
      <p className="tiny muted">
        <strong>Beeld:</strong> {post.visualBrief}
        {post.bestTime ? ` · Beste moment: ${post.bestTime}` : ''}
      </p>
      <div className="row between">
        <div className="row">
          {share ? (
            <a className="button primary small" href={share} target="_blank" rel="noreferrer noopener">
              Post op {PLATFORM_LABELS[post.platform]}
            </a>
          ) : null}
          <CopyButton text={copy} label="Kopieer tekst" />
          {post.platform === 'instagram' ? (
            <a className="button secondary small" href={META_PLANNER} target="_blank" rel="noreferrer noopener" title="Plak de tekst en het beeld in Meta; Meta plaatst de post op het moment dat je kiest">
              Inplannen in Meta
            </a>
          ) : null}
          <label className="row nowrap small" style={{ gap: '0.35rem' }}>
            <span className="muted">Plan</span>
            <input
              className="input"
              type="date"
              aria-label="Datum om te posten"
              defaultValue={post.plannedFor ?? ''}
              disabled={pending || post.status === 'done'}
              style={{ minHeight: 36, width: 'auto' }}
              onChange={(e) => {
                const day = e.target.value || null
                start(() => planContent(post.id, day))
              }}
            />
          </label>
          <DoneToggle id={post.id} done={post.status === 'done'} label="Gepost" />
        </div>
        <ContentActions id={post.id} rating={post.rating} archived={post.status === 'archived'} />
      </div>
    </article>
  )
}
