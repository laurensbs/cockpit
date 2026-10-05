import 'server-only'
import { and, eq, gte, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayOf, weekStart } from '@/lib/dates'
import { type ScoreEvent, weekScore, type WeekScore } from '@/lib/week-score'

/**
 * The week from what the cockpit already keeps: a call card ticked off (a prospect quest), a business that
 * asked for information after a call, an answer or a meeting, a post marked as posted, value given.
 */
export async function loadWeekScore(db: Db, ownerId: string, projectId?: string, now = new Date()): Promise<WeekScore> {
  const today = dayOf(now)
  const start = weekStart(today)
  const lastStart = addDays(start, -7)
  const own = (col: typeof s.xpEvent.ownerId) => eq(col, ownerId)
  const [xp, calls, info] = await Promise.all([
    db
      .select({ kind: s.xpEvent.kind, projectId: s.xpEvent.projectId, day: s.xpEvent.day })
      .from(s.xpEvent)
      .where(and(own(s.xpEvent.ownerId), gte(s.xpEvent.day, lastStart), inArray(s.xpEvent.kind, ['reply', 'post', 'give']))),
    db
      .select({ projectId: s.xpEvent.projectId, day: s.xpEvent.day })
      .from(s.xpEvent)
      .innerJoin(s.quest, eq(s.quest.id, s.xpEvent.refId))
      .where(and(own(s.xpEvent.ownerId), eq(s.xpEvent.kind, 'quest'), eq(s.quest.source, 'prospect'), gte(s.xpEvent.day, lastStart))),
    db
      .select({ projectId: s.contact.projectId, at: s.contact.lastContactAt })
      .from(s.contact)
      .where(and(eq(s.contact.ownerId, ownerId), eq(s.contact.source, 'prospect'), eq(s.contact.basis, 'consent'), gte(s.contact.lastContactAt, new Date(`${lastStart}T00:00:00Z`)))),
  ])
  const measureOf = { reply: 'answered', post: 'posted', give: 'helped' } as const
  const events: ScoreEvent[] = [
    ...xp.map((e) => ({ measure: measureOf[e.kind as keyof typeof measureOf], projectId: e.projectId, day: e.day })),
    ...calls.map((e) => ({ measure: 'called' as const, projectId: e.projectId, day: e.day })),
    ...info.filter((c) => c.at).map((c) => ({ measure: 'info' as const, projectId: c.projectId, day: dayOf(c.at!) })),
  ].filter((e) => !projectId || e.projectId === projectId)
  return weekScore(events, start, lastStart)
}
