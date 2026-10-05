import 'server-only'
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, addMonths, dayOf, monthStart } from '@/lib/dates'
import { isMetricKey, METRIC_DEFS, type MetricKey, monthRollup, type Point, resolveDaily } from '@/lib/metrics'
import { currentValue } from '@/lib/pace'

export interface PointRow extends Point {
  projectId: string
  key: string
  note: string
}

/** Stores points of one source; a second pull of the same day replaces the value instead of adding a row. */
export async function upsertPoints(db: Db, ownerId: string, projectId: string, source: string, points: { key: string; day: string; value: number; note?: string }[]): Promise<number> {
  if (!points.length) return 0
  const now = new Date()
  for (const chunk of Array.from({ length: Math.ceil(points.length / 200) }, (_, i) => points.slice(i * 200, i * 200 + 200))) {
    await db
      .insert(s.metricPoint)
      .values(chunk.map((p) => ({ id: crypto.randomUUID(), ownerId, projectId, key: p.key, day: p.day, value: p.value, source, note: p.note ?? '' })))
      .onConflictDoUpdate({
        target: [s.metricPoint.projectId, s.metricPoint.key, s.metricPoint.day, s.metricPoint.source],
        set: { value: sql`excluded.value`, note: sql`excluded.note`, updatedAt: now },
      })
  }
  return points.length
}

/** All points of the owner since a day, optionally for some projects and keys. */
export async function loadPoints(db: Db, ownerId: string, since: string, filter: { projectIds?: string[]; keys?: string[] } = {}): Promise<PointRow[]> {
  if (filter.projectIds && !filter.projectIds.length) return []
  return db
    .select({ projectId: s.metricPoint.projectId, key: s.metricPoint.key, day: s.metricPoint.day, value: s.metricPoint.value, source: s.metricPoint.source, note: s.metricPoint.note })
    .from(s.metricPoint)
    .where(
      and(
        eq(s.metricPoint.ownerId, ownerId),
        gte(s.metricPoint.day, since),
        ...(filter.projectIds ? [inArray(s.metricPoint.projectId, filter.projectIds)] : []),
        ...(filter.keys?.length ? [inArray(s.metricPoint.key, filter.keys)] : []),
      ),
    )
}

/** One value per day for a project's metric, with the sources combined the way the metric adds up. */
export function dailySeries(rows: PointRow[], projectId: string, key: string): Map<string, number> {
  if (!isMetricKey(key)) return new Map()
  return resolveDaily(
    rows.filter((r) => r.projectId === projectId && r.key === key),
    METRIC_DEFS[key],
  )
}

/**
 * Writes the months of these keys into the monthly table, so the companies page, the CSV and Claude's
 * numbers see them. A number he typed for a month is never overwritten.
 */
export async function rollupMonths(db: Db, ownerId: string, projectId: string, keys: string[], now = new Date()): Promise<void> {
  const known = [...new Set(keys)].filter(isMetricKey)
  if (!known.length) return
  const rows = await loadPoints(db, ownerId, addDays(dayOf(now), -400), { projectIds: [projectId], keys: known })
  for (const key of known) {
    const months = monthRollup(dailySeries(rows, projectId, key), METRIC_DEFS[key])
    for (const [month, value] of months) {
      await db
        .insert(s.metric)
        .values({ id: crypto.randomUUID(), ownerId, projectId, month, key, value: Math.round(value * 100) / 100, source: 'auto' })
        .onConflictDoUpdate({
          target: [s.metric.projectId, s.metric.month, s.metric.key],
          set: { value: Math.round(value * 100) / 100, source: 'auto', updatedAt: now },
          setWhere: sql`${s.metric.source} <> 'manual'`,
        })
    }
  }
}

/**
 * After points were taken away (a source switched off): the derived months of these keys are made
 * again from the points that are left. What he typed for a month stays.
 */
export async function rebuildMonths(db: Db, ownerId: string, projectId: string, keys: string[], now = new Date()): Promise<void> {
  const known = [...new Set(keys)].filter(isMetricKey)
  if (!known.length) return
  const from = addMonths(monthStart(addDays(dayOf(now), -400)), 1)
  await db
    .delete(s.metric)
    .where(and(eq(s.metric.ownerId, ownerId), eq(s.metric.projectId, projectId), inArray(s.metric.key, known), eq(s.metric.source, 'auto'), gte(s.metric.month, from)))
  await rollupMonths(db, ownerId, projectId, known, now)
}

/** Where the line to a target starts: the value now (the latest level, or a flow's last 30 days). */
export async function startingPoint(db: Db, ownerId: string, projectId: string, key: MetricKey, today: string): Promise<number | null> {
  const rows = await loadPoints(db, ownerId, addDays(today, -60), { projectIds: [projectId], keys: [key] })
  return currentValue(METRIC_DEFS[key], dailySeries(rows, projectId, key), today)
}
