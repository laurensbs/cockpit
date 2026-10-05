// The rules for publishing what he approved: when a post may go out, how many per channel per day,
// how long to wait after a failure, and how text must be written for LinkedIn. Pure, like the mail
// rules in outbox.ts, so the publisher and the tests agree.

import { TIME_ZONE } from './dates'

export const PUBLISH_CHANNELS = ['linkedin', 'instagram', 'tiktok'] as const
export type PublishChannel = (typeof PUBLISH_CHANNELS)[number]
export const isPublishChannel = (v: unknown): v is PublishChannel => typeof v === 'string' && (PUBLISH_CHANNELS as readonly string[]).includes(v)

/** At most this many posts per channel per day, however many he approved. */
export const DAILY_CAP: Record<PublishChannel, number> = { linkedin: 2, instagram: 3, tiktok: 3 }
/** Never two posts on one channel within this gap. */
export const CHANNEL_GAP_MS = 30 * 60_000
/** Only between these hours (Amsterdam), so nothing appears at night. */
export const WINDOW = { from: 7, to: 22 }
/** Waits after a failure that may pass (a busy service, a lost connection); then it stops. */
export const BACKOFF_MS = [15 * 60_000, 60 * 60_000] as const
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1

const parts = (date: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  )
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), min: Number(p.minute), s: Number(p.second) }
}

/** The moment a day and a time in Amsterdam happen ("2026-10-06", "08:15"), summer time included. */
export function amsterdamTime(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = (/^\d{1,2}:\d{2}$/.test(time) ? time : '12:00').split(':').map(Number)
  const wanted = Date.UTC(y, m - 1, d, hh, mm)
  let at = wanted
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(at))
    at += wanted - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s)
  }
  return new Date(at)
}

export function inWindow(now: Date): boolean {
  const h = parts(now).h
  return h >= WINDOW.from && h < WINDOW.to
}

/** When a failed attempt may be tried again, or null when it should stop. */
export function nextTry(attempts: number, now: Date, retryable: boolean): Date | null {
  if (!retryable || attempts >= MAX_ATTEMPTS) return null
  return new Date(now.getTime() + BACKOFF_MS[Math.max(0, attempts - 1)])
}

/**
 * May this channel publish now? Not when it hit its daily cap, and not within the gap after the last
 * post. `published` are the times of today's posts on that channel.
 */
export function channelAllows(channel: PublishChannel, published: Date[], now: Date): { ok: true } | { ok: false; why: 'cap' | 'gap' } {
  if (published.length >= DAILY_CAP[channel]) return { ok: false, why: 'cap' }
  const last = Math.max(0, ...published.map((d) => d.getTime()))
  if (last && now.getTime() - last < CHANNEL_GAP_MS) return { ok: false, why: 'gap' }
  return { ok: true }
}

/**
 * LinkedIn reads post text as "little text": these characters mean something there and must be
 * escaped, or the post is cut off or refused.
 */
export function littleText(text: string): string {
  const escape = (s: string) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`)
  // A hashtag stays a hashtag (clickable) in LinkedIn's own notation.
  return text
    .split(/(#[\p{L}\p{N}]+)/u)
    .map((part, i) => (i % 2 ? `{hashtag|\\#|${part.slice(1)}}` : escape(part)))
    .join('')
}
