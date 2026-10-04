'use client'

import { useTransition } from 'react'
import { shareUrl } from '@/lib/share'
import { planContent } from '@/server/actions/content'
import { ContentActions } from './ContentActions'
import { CopyButton } from './CopyButton'
import { DoneToggle } from './DoneToggle'

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
}

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
          <span className="chip accent">{PLATFORM_LABELS[post.platform] ?? post.platform}</span>
          <span className="chip">{post.format}</span>
        </span>
        {post.projectName ? <span className="tiny faint">{post.projectName}</span> : null}
      </div>
      <p className="draft-subject">{post.hook}</p>
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
