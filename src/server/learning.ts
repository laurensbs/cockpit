import 'server-only'
import { and, desc, eq, gte } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayOf } from '@/lib/dates'
import { learningLines } from '@/lib/learning'
import { weekLearning } from '@/lib/week-score'
import { loadWeekScore } from './week-score'

/** What his choices of the last 30 days taught, for Claude's next search or posts on this project. */
export async function learningFor(db: Db, projectId: string): Promise<string[]> {
  const today = dayOf(new Date())
  const since = new Date(`${addDays(today, -30)}T00:00:00Z`)
  const [prospects, posts, reach] = await Promise.all([
    db
      .select({ status: s.contact.status, city: s.contact.city, note: s.contact.note, basis: s.contact.basis })
      .from(s.contact)
      .where(and(eq(s.contact.projectId, projectId), eq(s.contact.source, 'prospect'), gte(s.contact.createdAt, since))),
    db
      .select({ platform: s.contentItem.channel, status: s.contentItem.status })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.projectId, projectId), eq(s.contentItem.kind, 'social'), gte(s.contentItem.createdAt, since)))
      .orderBy(desc(s.contentItem.createdAt))
      .limit(20),
    db
      .select({ day: s.metricPoint.day, value: s.metricPoint.value })
      .from(s.metricPoint)
      .where(and(eq(s.metricPoint.projectId, projectId), eq(s.metricPoint.key, 'reach'), gte(s.metricPoint.day, addDays(today, -14)))),
  ])
  const cut = addDays(today, -7)
  const sum = (rows: { value: number }[]) => Math.round(rows.reduce((t, r) => t + r.value, 0))
  const lines = learningLines(
    prospects,
    posts.map((p) => ({ platform: p.platform || 'linkedin', done: p.status === 'done' })),
    reach.length ? { last7: sum(reach.filter((r) => r.day > cut)), before7: sum(reach.filter((r) => r.day <= cut)) } : null,
  )
  // What he did on this project this week, next to last week.
  const [owner] = await db.select({ ownerId: s.project.ownerId }).from(s.project).where(eq(s.project.id, projectId))
  const week = owner ? weekLearning(await loadWeekScore(db, owner.ownerId, projectId)) : null
  return week ? [...lines, week] : lines
}
