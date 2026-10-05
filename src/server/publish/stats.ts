import 'server-only'
import { and, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { WeekBody } from '@/lib/content-week'
import { addDays, dayOf } from '@/lib/dates'
import { instagramInsights, MEASURE_DAYS, normalizeStats, type PostStats, reachOf, RESULT_DAYS, tiktokStats } from '@/lib/post-stats'
import { rollupMonths, upsertPoints } from '../points'
import { accounts } from './accounts'
import { call, callJson, PublishError } from './http'
import { freshTiktok, IG, TIKTOK } from './platforms'

// The numbers of his posts, fetched once a day in the daily round (and on his button): per post on
// Instagram and TikTok for 30 days after it went out, and the follower counts per project. LinkedIn
// gives a member's own post numbers only to approved partners, so those he types in himself.

const DAY_GAP = 20 * 3600_000
const FORCE_GAP = 10 * 60_000

export interface StatsRun {
  measured: number
  failed: number
  followers: number
}

type Job = typeof s.publishJob.$inferSelect & { format: string }

async function save(db: Db, job: Job, stats: PostStats, now: Date, extra: Partial<typeof s.publishJob.$inferInsert> = {}) {
  await db
    .update(s.publishJob)
    .set({ stats: { ...normalizeStats(job.stats), ...stats }, statsAt: now, ...extra })
    .where(eq(s.publishJob.id, job.id))
}

// ---------- Instagram ----------

async function instagramPost(token: string, job: Job): Promise<PostStats> {
  const metric = job.format === 'story' ? 'views,reach,shares' : 'views,reach,likes,comments,shares,saved'
  try {
    return instagramInsights(await callJson('Instagram', `${IG}/${job.remoteId}/insights?${new URLSearchParams({ metric, access_token: token })}`))
  } catch (error) {
    // Insights can be missing (too few views, an older post); the plain counts are always there.
    if (!(error instanceof PublishError) || error.retryable || job.format === 'story') throw error
    const r = await callJson<{ like_count?: number; comments_count?: number }>('Instagram', `${IG}/${job.remoteId}?${new URLSearchParams({ fields: 'like_count,comments_count', access_token: token })}`)
    return normalizeStats({ likes: r.like_count, comments: r.comments_count })
  }
}

async function instagramFollowers(token: string): Promise<number | null> {
  const r = await callJson<{ followers_count?: number }>('Instagram', `${IG}/me?${new URLSearchParams({ fields: 'followers_count', access_token: token })}`)
  return typeof r.followers_count === 'number' ? r.followers_count : null
}

// ---------- TikTok ----------

/**
 * A video uploaded to his drafts has no post id until he posts it in the app; then the status says
 * which. Read from the raw text: TikTok's ids do not fit in a JavaScript number.
 */
async function tiktokPostId(accessToken: string, publishId: string): Promise<string | null> {
  const res = await call('TikTok', `${TIKTOK}/v2/post/publish/status/fetch/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ publish_id: publishId }),
  })
  const text = await res.text()
  if (!/"status"\s*:\s*"PUBLISH_COMPLETE"/.test(text)) return null
  return text.match(/"publicaly_available_post_id"\s*:\s*\[\s*"?(\d{6,30})/)?.[1] ?? null
}

interface TiktokVideo {
  id?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
  share_url?: string
}

async function tiktokVideos(accessToken: string, ids: string[]): Promise<TiktokVideo[]> {
  const out: TiktokVideo[] = []
  for (let i = 0; i < ids.length; i += 20) {
    const r = await callJson<{ data?: { videos?: TiktokVideo[] } }>('TikTok', `${TIKTOK}/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count,share_url`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ filters: { video_ids: ids.slice(i, i + 20) } }),
    })
    out.push(...(r.data?.videos ?? []))
  }
  return out
}

async function tiktokFollowers(accessToken: string): Promise<number | null> {
  const r = await callJson<{ data?: { user?: { follower_count?: number } } }>('TikTok', `${TIKTOK}/v2/user/info/?fields=follower_count`, { headers: { Authorization: `Bearer ${accessToken}` } })
  const n = r.data?.user?.follower_count
  return typeof n === 'number' ? n : null
}

const isVideoId = (id: string | null): id is string => Boolean(id && /^\d{6,30}$/.test(id))

// ---------- The round ----------

/** Per project and publishing day: how many people his posts reached, as the social_reach metric. */
export async function recountReach(db: Db, ownerId: string, projectIds: string[], now = new Date()): Promise<void> {
  if (!projectIds.length) return
  const rows = await db
    .select({ projectId: s.publishJob.projectId, publishedAt: s.publishJob.publishedAt, stats: s.publishJob.stats })
    .from(s.publishJob)
    .where(
      and(
        eq(s.publishJob.ownerId, ownerId),
        eq(s.publishJob.status, 'published'),
        inArray(s.publishJob.projectId, projectIds),
        gte(s.publishJob.publishedAt, new Date(`${addDays(dayOf(now), -RESULT_DAYS)}T00:00:00Z`)),
        isNotNull(s.publishJob.stats),
      ),
    )
  for (const projectId of projectIds) {
    const perDay = new Map<string, number>()
    for (const r of rows.filter((x) => x.projectId === projectId && x.publishedAt)) {
      const day = dayOf(r.publishedAt!)
      perDay.set(day, (perDay.get(day) ?? 0) + reachOf(normalizeStats(r.stats)))
    }
    if (!perDay.size) continue
    await upsertPoints(
      db,
      ownerId,
      projectId,
      'posts',
      [...perDay].map(([day, value]) => ({ key: 'social_reach', day, value })),
    )
    await rollupMonths(db, ownerId, projectId, ['social_reach'], now)
  }
}

/** Fetch what can be fetched; a channel that fails is skipped (and tried again tomorrow). */
export async function pullPostStats(db: Db, ownerId: string, { force = false, now = new Date() }: { force?: boolean; now?: Date } = {}): Promise<StatsRun> {
  const lock = globalThis as unknown as { __cockpitStats?: Set<string> }
  lock.__cockpitStats ??= new Set()
  if (lock.__cockpitStats.has(ownerId)) return { measured: 0, failed: 0, followers: 0 }
  lock.__cockpitStats.add(ownerId)
  const run: StatsRun = { measured: 0, failed: 0, followers: 0 }
  const touched = new Set<string>()
  try {
    const gap = force ? FORCE_GAP : DAY_GAP
    const jobs: Job[] = (
      await db
        .select({ job: s.publishJob, body: s.contentItem.body })
        .from(s.publishJob)
        .innerJoin(s.contentItem, eq(s.contentItem.id, s.publishJob.contentItemId))
        .where(
          and(
            eq(s.publishJob.ownerId, ownerId),
            eq(s.publishJob.status, 'published'),
            inArray(s.publishJob.channel, ['instagram', 'tiktok']),
            isNotNull(s.publishJob.remoteId),
            gte(s.publishJob.publishedAt, new Date(now.getTime() - MEASURE_DAYS * 86_400_000)),
          ),
        )
    )
      .filter(({ job }) => !job.statsAt || now.getTime() - job.statsAt.getTime() >= gap)
      .map(({ job, body }) => ({ ...job, format: (body as WeekBody).contentFormat ?? 'post' }))

    const projects = await db.select({ id: s.project.id }).from(s.project).where(eq(s.project.ownerId, ownerId))
    const today = dayOf(now)
    for (const { id: projectId } of projects) {
      // Instagram: the project's professional account.
      const ig = await accounts.instagram(db, ownerId, projectId)
      if (ig) {
        for (const job of jobs.filter((j) => j.channel === 'instagram' && j.projectId === projectId)) {
          try {
            await save(db, job, await instagramPost(ig.token, job), now)
            run.measured++
            touched.add(projectId)
          } catch {
            run.failed++
          }
        }
        try {
          const n = await instagramFollowers(ig.token)
          if (n != null) {
            await upsertPoints(db, ownerId, projectId, 'instagram', [{ key: 'instagram_followers', day: today, value: n }])
            await rollupMonths(db, ownerId, projectId, ['instagram_followers'], now)
            run.followers++
          }
        } catch {
          run.failed++
        }
      }

      // TikTok: first which drafts he posted, then the numbers of the posted videos.
      if (!(await accounts.tiktok(db, ownerId, projectId))) continue
      let token: string
      try {
        token = (await freshTiktok(db, ownerId, projectId)).accessToken
      } catch {
        run.failed++
        continue
      }
      const own = jobs.filter((j) => j.channel === 'tiktok' && j.projectId === projectId)
      for (const job of own.filter((j) => !isVideoId(j.remoteId))) {
        try {
          const id = await tiktokPostId(token, job.remoteId!)
          if (id) {
            await db.update(s.publishJob).set({ remoteId: id, error: null }).where(eq(s.publishJob.id, job.id))
            job.remoteId = id
          }
        } catch {
          run.failed++
        }
      }
      const live = own.filter((j) => isVideoId(j.remoteId))
      if (live.length) {
        try {
          const videos = await tiktokVideos(
            token,
            live.map((j) => j.remoteId!),
          )
          for (const job of live) {
            const v = videos.find((x) => String(x.id) === job.remoteId)
            if (!v) continue
            const link = v.share_url && /^https:\/\/([a-z0-9-]+\.)*tiktok\.com\//.test(v.share_url) ? v.share_url : null
            await save(db, job, tiktokStats(v), now, link && !job.permalink ? { permalink: link } : {})
            run.measured++
            touched.add(projectId)
          }
        } catch {
          run.failed++
        }
      }
      try {
        const n = await tiktokFollowers(token)
        if (n != null) {
          await upsertPoints(db, ownerId, projectId, 'tiktok', [{ key: 'tiktok_followers', day: today, value: n }])
          await rollupMonths(db, ownerId, projectId, ['tiktok_followers'], now)
          run.followers++
        }
      } catch {
        run.failed++
      }
    }
    await recountReach(db, ownerId, [...touched], now)
    return run
  } finally {
    lock.__cockpitStats.delete(ownerId)
  }
}
