// What Claude hands back for the content week, made safe and complete: formats that fit the channel,
// days within the next two weeks, sane lengths, slides and beats where the format needs them, and at
// most one LinkedIn post per day on his profile. Pure, so the tool and the tests agree.

import type { ContentItemInput } from './ai/schemas'
import { clean, hashtags as cleanTags, safeLink } from './ai/schemas'
import { CHANNEL_FORMATS, CHANNEL_LIMITS, type ContentChannel, type ContentFormat, DEFAULT_TIME, FORMAT_LABELS, LINKEDIN_WEEK_MAX } from './ai/playbooks'
import { addDays, weekStart } from './dates'
import { isMetricKey, type MetricKey } from './metrics'

export interface Slide {
  title: string
  body: string
}

export interface ReelPlan {
  durationSec: number
  beats: { sec: number; text: string; shot: string }[]
  coverText: string
  voiceover: string
  mediaIds: string[]
}

export interface ContentPiece {
  project: string
  channel: ContentChannel
  format: ContentFormat
  language: string | null
  title: string
  hook: string
  text: string
  hashtags: string[]
  day: string
  time: string
  slides: Slide[]
  reel: ReelPlan | null
  forum: { place: string; url: string; answer: string; disclosure: string } | null
  goal: MetricKey | null
  why: string
  replaces: string | null
}

export const CONTENT_WINDOW_DAYS = 14

const time = (value: string | undefined, channel: ContentChannel) => (value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim()) ? value.trim() : DEFAULT_TIME[channel])
/** Emoji draw as empty boxes on slides; keep them out of the slide text (captions keep theirs). */
export const slideText = (text: string, max: number) => clean(text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' '), max)

/** One item, or why it cannot be used. */
export function normalizePiece(raw: ContentItemInput, today: string): { ok: ContentPiece } | { error: string } {
  const channel = raw.channel
  const format = raw.format
  const label = raw.title?.trim() || raw.hook?.trim() || 'item'
  if (!CHANNEL_FORMATS[channel].includes(format)) return { error: `"${label}": ${channel} takes ${CHANNEL_FORMATS[channel].join(', ')}, not ${format}.` }
  const day = (raw.day ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < today || day > addDays(today, CONTENT_WINDOW_DAYS - 1)) return { error: `"${label}": day must be between ${today} and ${addDays(today, CONTENT_WINDOW_DAYS - 1)}.` }
  const limits = CHANNEL_LIMITS[channel]
  const slides = (raw.slides ?? []).map((s) => ({ title: slideText(s.title ?? '', 90), body: slideText(s.body ?? '', 220) })).filter((s) => s.title)
  if (format === 'image' && slides.length < 1) return { error: `"${label}": an image needs one slide (title and body).` }
  if ((format === 'carousel' || format === 'document' || format === 'story') && slides.length < 3) return { error: `"${label}": a ${format} needs 3–10 slides.` }
  let reel: ReelPlan | null = null
  if (format === 'reel') {
    const beats = (raw.reel?.beats ?? [])
      .map((b) => ({ sec: Math.max(0, Math.round(Number(b.sec) * 10) / 10 || 0), text: slideText(b.text ?? '', 80), shot: clean(b.shot ?? '', 160) }))
      .filter((b) => b.text)
      .sort((a, b) => a.sec - b.sec)
    if (beats.length < 2) return { error: `"${label}": a reel needs at least two beats with on-screen text.` }
    const last = beats[beats.length - 1].sec
    const durationSec = Math.min(90, Math.max(5, Math.round(Number(raw.reel?.durationSec) || last + 3), Math.ceil(last + 2)))
    reel = {
      durationSec,
      beats,
      coverText: slideText(raw.reel?.coverText || raw.hook || beats[0].text, 60),
      voiceover: clean(raw.reel?.voiceover ?? '', 1200),
      mediaIds: (raw.reel?.mediaIds ?? []).map((m) => m.trim()).filter(Boolean).slice(0, 6),
    }
  }
  let forum: ContentPiece['forum'] = null
  if (format === 'answer') {
    const url = raw.forum?.url ? safeLink(raw.forum.url) : null
    const answer = clean(raw.forum?.answer ?? '', limits.text)
    if (!url || !answer || !raw.forum?.place?.trim()) return { error: `"${label}": a forum answer needs the place, its URL and the answer.` }
    forum = { place: clean(raw.forum.place, 80), url, answer, disclosure: clean(raw.forum.disclosure ?? '', 200) }
  }
  const hook = clean(raw.hook ?? '', 220)
  const text = clean(raw.text ?? '', limits.text)
  if (!text && !forum) return { error: `"${label}": the text is empty.` }
  return {
    ok: {
      project: (raw.project ?? '').trim(),
      channel,
      format,
      language: raw.language ?? null,
      title: clean(raw.title || hook || text, 90),
      hook,
      text: text || forum?.answer.slice(0, 200) || '',
      hashtags: limits.hashtags ? cleanTags(raw.hashtags ?? []).slice(0, limits.hashtags) : [],
      day,
      time: time(raw.time, channel),
      slides: format === 'image' ? slides.slice(0, 1) : slides.slice(0, 10),
      reel,
      forum,
      goal: isMetricKey(raw.goal) ? raw.goal : null,
      why: clean(raw.why ?? '', 200),
      replaces: raw.replaces?.trim() || null,
    },
  }
}

/**
 * The whole batch: each item checked on its own, then his LinkedIn kept humane — one post a day and
 * at most LINKEDIN_WEEK_MAX a week, counting what is already planned.
 */
export function normalizeWeek(items: ContentItemInput[], today: string, plannedLinkedin: string[] = []): { ok: ContentPiece[]; skipped: string[] } {
  const ok: ContentPiece[] = []
  const skipped: string[] = []
  const linkedinDays = new Set(plannedLinkedin)
  const perWeek = new Map<string, number>()
  for (const d of plannedLinkedin) perWeek.set(weekStart(d), (perWeek.get(weekStart(d)) ?? 0) + 1)
  for (const raw of items) {
    const r = normalizePiece(raw, today)
    if ('error' in r) {
      skipped.push(r.error)
      continue
    }
    const piece = r.ok
    if (piece.channel === 'linkedin' && !piece.replaces) {
      const week = weekStart(piece.day)
      if (linkedinDays.has(piece.day)) {
        skipped.push(`"${piece.title}": there is already a LinkedIn post on ${piece.day}; one a day at most.`)
        continue
      }
      if ((perWeek.get(week) ?? 0) >= LINKEDIN_WEEK_MAX) {
        skipped.push(`"${piece.title}": at most ${LINKEDIN_WEEK_MAX} LinkedIn posts a week on his profile.`)
        continue
      }
      linkedinDays.add(piece.day)
      perWeek.set(week, (perWeek.get(week) ?? 0) + 1)
    }
    ok.push(piece)
  }
  return { ok, skipped }
}

/**
 * How an item of the content week is stored in content_item.body. It keeps the fields of an older
 * social draft (format, hook, caption, hashtags, visualBrief, bestTime), so every list can show it.
 */
export interface WeekBody {
  week: true
  contentFormat: ContentFormat
  format: string
  hook: string
  caption: string
  hashtags: string[]
  visualBrief: string
  bestTime: string
  time: string
  slides: Slide[]
  reel: ReelPlan | null
  forum: ContentPiece['forum']
  goal: MetricKey | null
  why: string
  render?: { status: 'pending' | 'done' | 'failed'; at?: string; count?: number; error?: string; video?: 'done' | 'missing' | 'failed' }
  /** The CapCut package: the folder on his computer, and when it was made. */
  capcut?: { dir: string; at: string }
  approvedAt?: string
}

/** What to film or design, in one line, for lists that only know the older drafts. */
function visualBrief(piece: ContentPiece): string {
  if (piece.reel) return piece.reel.beats.map((b) => `${b.sec}s: ${b.text}${b.shot ? ` (${b.shot})` : ''}`).join(' · ')
  if (piece.slides.length) return piece.slides.map((s, i) => `${i + 1}. ${s.title}`).join(' · ')
  return ''
}

export function weekBody(piece: ContentPiece): WeekBody {
  return {
    week: true,
    contentFormat: piece.format,
    format: FORMAT_LABELS[piece.format],
    hook: piece.hook,
    caption: piece.text,
    hashtags: piece.hashtags,
    visualBrief: visualBrief(piece),
    bestTime: piece.time,
    time: piece.time,
    slides: piece.slides,
    reel: piece.reel,
    forum: piece.forum,
    goal: piece.goal,
    why: piece.why,
    render: { status: 'pending' },
  }
}
