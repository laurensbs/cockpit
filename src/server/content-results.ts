import 'server-only'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { WeekBody } from '@/lib/content-week'
import { addDays, dayOf } from '@/lib/dates'
import { lastOnOrBefore, METRIC_DEFS, resolveDaily } from '@/lib/metrics'
import { type FollowerLine, type MeasuredPost, normalizeStats, performanceLines, RESULT_DAYS, summarize } from '@/lib/post-stats'
import { isPublishChannel } from '@/lib/publish'
import { loadPoints } from './points'

// What his posts did, read back from the database: for the "Wat werkt" part of the content week,
// for Claude's content brief and for the MCP. Nothing here talks to a platform.

const clock = (d: Date) => new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(d)

/** His posts that went out in the last days, with their numbers (empty numbers when not measured yet). */
export async function publishedPosts(db: Db, ownerId: string, now = new Date(), projectIds?: string[]): Promise<MeasuredPost[]> {
  if (projectIds && !projectIds.length) return []
  const since = new Date(`${addDays(dayOf(now), -RESULT_DAYS)}T00:00:00Z`)
  const rows = await db
    .select({ job: s.publishJob, body: s.contentItem.body, title: s.contentItem.title })
    .from(s.publishJob)
    .innerJoin(s.contentItem, eq(s.contentItem.id, s.publishJob.contentItemId))
    .where(
      and(
        eq(s.publishJob.ownerId, ownerId),
        eq(s.publishJob.status, 'published'),
        gte(s.publishJob.publishedAt, since),
        ...(projectIds ? [inArray(s.publishJob.projectId, projectIds)] : []),
      ),
    )
    .orderBy(desc(s.publishJob.publishedAt))
  return rows
    .filter((r) => isPublishChannel(r.job.channel) && r.job.publishedAt)
    .map(({ job, body, title }) => {
      const b = body as WeekBody
      return {
        id: job.contentItemId,
        projectId: job.projectId,
        channel: job.channel,
        format: b.contentFormat ?? b.format ?? 'post',
        hook: b.hook || title,
        day: dayOf(job.publishedAt!),
        time: clock(job.publishedAt!),
        stats: normalizeStats(job.stats),
        permalink: job.permalink,
      }
    })
}

const FOLLOWER_KEYS = { instagram: 'instagram_followers', tiktok: 'tiktok_followers', linkedin: 'linkedin_followers' } as const

/** Per channel: the latest follower count and how it moved in 30 days. */
export async function followerLines(db: Db, ownerId: string, projectId: string, now = new Date()): Promise<FollowerLine[]> {
  const today = dayOf(now)
  const rows = await loadPoints(db, ownerId, addDays(today, -45), { projectIds: [projectId], keys: Object.values(FOLLOWER_KEYS) })
  const out: FollowerLine[] = []
  for (const [channel, key] of Object.entries(FOLLOWER_KEYS)) {
    const daily = resolveDaily(
      rows.filter((r) => r.key === key),
      METRIC_DEFS[key],
    )
    const latest = lastOnOrBefore(daily, today)
    if (!latest) continue
    const before = lastOnOrBefore(daily, addDays(today, -30))
    out.push({ channel, now: latest.value, change30: before ? latest.value - before.value : null })
  }
  return out
}

/** The results of one project as lines for Claude's brief; null when nothing was measured yet. */
export async function performanceFor(db: Db, ownerId: string, projectId: string, now = new Date()): Promise<string[] | null> {
  const [posts, followers] = await Promise.all([publishedPosts(db, ownerId, now, [projectId]), followerLines(db, ownerId, projectId, now)])
  const lines = performanceLines(summarize(posts), followers)
  return lines.length ? lines : null
}
