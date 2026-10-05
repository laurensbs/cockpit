import 'server-only'
import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { WeekBody } from '@/lib/content-week'
import { dayOf } from '@/lib/dates'
import { amsterdamTime, channelAllows, inWindow, isPublishChannel, nextTry, type PublishChannel } from '@/lib/publish'
import { getSetting } from '../settings'
import { fixturesAllowed } from '../status'
import { award } from '../xp'
import { channelReady } from './accounts'
import { PublishError } from './http'
import { type Published, type PublishInput, publishInstagram, publishLinkedin, publishTiktok } from './platforms'

// The publishing queue: what he approved goes out on its day and time, one post at a time, within the
// day's window and each channel's cap, and never while he paused publishing.

const PUBLISHERS: Record<PublishChannel, (input: PublishInput) => Promise<Published>> = { linkedin: publishLinkedin, instagram: publishInstagram, tiktok: publishTiktok }

export const isPaused = async (db: Db, ownerId: string) => (await getSetting(db, ownerId, 'publish_paused')) === '1'
const anytime = () => fixturesAllowed() && process.env.COCKPIT_PUBLISH_ANYTIME === '1'

/** After he approves: a job for the post's moment, when its channel is connected. Else he posts it by hand. */
export async function schedulePublish(db: Db, ownerId: string, itemId: string, now = new Date()): Promise<'queued' | 'manual' | 'exists'> {
  const [item] = await db
    .select()
    .from(s.contentItem)
    .where(and(eq(s.contentItem.id, itemId), eq(s.contentItem.ownerId, ownerId)))
  if (!item || !isPublishChannel(item.channel) || item.status !== 'approved') return 'manual'
  if (!(await channelReady(db, ownerId, item.channel, item.projectId))) return 'manual'
  const [open] = await db
    .select({ id: s.publishJob.id })
    .from(s.publishJob)
    .where(and(eq(s.publishJob.contentItemId, item.id), inArray(s.publishJob.status, ['queued', 'publishing', 'published'])))
  if (open) return 'exists'
  const body = item.body as WeekBody
  const at = amsterdamTime(item.plannedFor ?? dayOf(now), body.time ?? '12:00')
  await db.insert(s.publishJob).values({
    id: crypto.randomUUID(),
    ownerId,
    projectId: item.projectId,
    contentItemId: item.id,
    channel: item.channel,
    publishAt: at < now ? new Date(now.getTime() + 60_000) : at,
  })
  return 'queued'
}

/** Approved posts without a job yet (approved before their channel was connected) get one now. */
export async function scheduleApproved(db: Db, ownerId: string): Promise<number> {
  const rows = await db
    .select({ id: s.contentItem.id })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.status, 'approved'), inArray(s.contentItem.channel, ['linkedin', 'instagram', 'tiktok'])))
  let queued = 0
  for (const r of rows) if ((await schedulePublish(db, ownerId, r.id)) === 'queued') queued++
  return queued
}

/** He took the approval back, edited it or skipped it: a job that has not run yet is cancelled. */
export async function cancelPublish(db: Db, ownerId: string, itemId: string): Promise<void> {
  await db
    .update(s.publishJob)
    .set({ status: 'cancelled' })
    .where(and(eq(s.publishJob.ownerId, ownerId), eq(s.publishJob.contentItemId, itemId), eq(s.publishJob.status, 'queued')))
}

export type RunOutcome = { ran: 'published' | 'failed' | 'retry'; jobId: string; error?: string } | { ran: 'nothing' | 'paused' | 'window' | 'busy' }

/** One due post, if the window, the caps and the pause allow it. */
export async function runPublisher(db: Db, ownerId: string, now = new Date(), { jobId }: { jobId?: string } = {}): Promise<RunOutcome> {
  if (await isPaused(db, ownerId)) return { ran: 'paused' }
  if (!jobId && !anytime() && !inWindow(now)) return { ran: 'window' }
  const lock = globalThis as unknown as { __cockpitPublishing?: Set<string> }
  lock.__cockpitPublishing ??= new Set()
  if (lock.__cockpitPublishing.has(ownerId)) return { ran: 'busy' }
  lock.__cockpitPublishing.add(ownerId)
  try {
    // A post that was being published when the app stopped: maybe it went out, maybe not. Say so
    // instead of trying again (twice online is worse than once by hand).
    await db
      .update(s.publishJob)
      .set({ status: 'failed', error: 'Onderbroken tijdens het plaatsen: kijk of hij online staat, en probeer anders opnieuw.' })
      .where(and(eq(s.publishJob.ownerId, ownerId), eq(s.publishJob.status, 'publishing'), lte(s.publishJob.publishAt, new Date(now.getTime() - 30 * 60_000))))
    const due = await db
      .select()
      .from(s.publishJob)
      .where(
        and(
          eq(s.publishJob.ownerId, ownerId),
          eq(s.publishJob.status, 'queued'),
          ...(jobId ? [eq(s.publishJob.id, jobId)] : [lte(s.publishJob.publishAt, now), or(isNull(s.publishJob.nextTryAt), lte(s.publishJob.nextTryAt, now))]),
        ),
      )
      .orderBy(asc(s.publishJob.publishAt))
    if (!due.length) return { ran: 'nothing' }
    const startOfDay = new Date(now.getTime() - 26 * 3600_000)
    const today = await db
      .select({ channel: s.publishJob.channel, at: s.publishJob.publishedAt })
      .from(s.publishJob)
      .where(and(eq(s.publishJob.ownerId, ownerId), eq(s.publishJob.status, 'published'), gte(s.publishJob.publishedAt, startOfDay)))
    const job = due.find((j) => {
      if (!isPublishChannel(j.channel)) return false
      if (jobId) return true
      const times = today.filter((t) => t.channel === j.channel && t.at && dayOf(t.at) === dayOf(now)).map((t) => t.at as Date)
      return channelAllows(j.channel, times, now).ok
    })
    if (!job || !isPublishChannel(job.channel)) return { ran: 'nothing' }
    const [item] = await db.select().from(s.contentItem).where(eq(s.contentItem.id, job.contentItemId))
    if (!item || item.status !== 'approved') {
      await db.update(s.publishJob).set({ status: 'cancelled' }).where(eq(s.publishJob.id, job.id))
      return { ran: 'nothing' }
    }
    const attempts = job.attempts + 1
    await db.update(s.publishJob).set({ status: 'publishing', attempts }).where(eq(s.publishJob.id, job.id))
    try {
      const result = await PUBLISHERS[job.channel]({ db, ownerId, item, body: item.body as WeekBody })
      await db
        .update(s.publishJob)
        .set({ status: 'published', remoteId: result.remoteId, permalink: result.permalink, publishedAt: now, error: result.note ?? null, nextTryAt: null })
        .where(eq(s.publishJob.id, job.id))
      await db.update(s.contentItem).set({ status: 'done', doneAt: now }).where(eq(s.contentItem.id, item.id))
      await award(db, ownerId, { kind: 'post', refId: item.id, projectId: item.projectId })
      return { ran: 'published', jobId: job.id }
    } catch (error) {
      const known = error instanceof PublishError ? error : new PublishError('Plaatsen lukte niet door een fout in de cockpit; hij probeert het later opnieuw.', true)
      if (!(error instanceof PublishError)) console.error('publish', error instanceof Error ? error.message : error)
      const retry = nextTry(attempts, now, known.retryable)
      await db
        .update(s.publishJob)
        .set(retry ? { status: 'queued', nextTryAt: retry, error: known.message } : { status: 'failed', error: known.message })
        .where(eq(s.publishJob.id, job.id))
      return { ran: retry ? 'retry' : 'failed', jobId: job.id, error: known.message }
    }
  } finally {
    lock.__cockpitPublishing.delete(ownerId)
  }
}
