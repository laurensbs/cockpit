import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { PIPELINE_METRICS } from '@/lib/options'
import { wonRevenue } from '@/lib/pipeline-board'
import { rebuildMonths, rollupMonths, upsertPoints } from './points'
import { getSetting } from './settings'

const ORDER = ['replied', 'meeting', 'offer', 'won']
const PIPELINE_KEYS = [...new Set(Object.values(PIPELINE_METRICS))]

/**
 * A contact took a step in the pipeline (an answer, a meeting, an offer, a won deal). The step is kept,
 * and that day's numbers are counted again from all steps, so a second click never counts twice. A step
 * back on the same day takes the later step of that day away again.
 */
export async function recordStage(db: Db, ownerId: string, contact: { id: string; projectId: string }, status: string, now = new Date()): Promise<void> {
  const day = dayOf(now)
  const rank = ORDER.indexOf(status)
  const undo = ORDER.filter((_, i) => i > rank)
  if (undo.length)
    await db.delete(s.contactEvent).where(and(eq(s.contactEvent.contactId, contact.id), eq(s.contactEvent.day, day), inArray(s.contactEvent.status, undo)))
  if (PIPELINE_METRICS[status]) {
    const [already] = await db
      .select({ id: s.contactEvent.id })
      .from(s.contactEvent)
      .where(and(eq(s.contactEvent.contactId, contact.id), eq(s.contactEvent.day, day), eq(s.contactEvent.status, status)))
    if (!already) await db.insert(s.contactEvent).values({ id: crypto.randomUUID(), ownerId, projectId: contact.projectId, contactId: contact.id, status, day })
  }
  await recountDay(db, ownerId, contact.projectId, day, now)
}

/** That day's leads, meetings, offers and won deals, as numbers from the pipeline. */
async function recountDay(db: Db, ownerId: string, projectId: string, day: string, now: Date): Promise<void> {
  const events = await db
    .select({ contactId: s.contactEvent.contactId, status: s.contactEvent.status })
    .from(s.contactEvent)
    .where(and(eq(s.contactEvent.projectId, projectId), eq(s.contactEvent.day, day)))
  const counts = Object.fromEntries(PIPELINE_KEYS.map((k) => [k, new Set<string>()])) as Record<string, Set<string>>
  for (const e of events) {
    const key = PIPELINE_METRICS[e.status]
    if (key) counts[key].add(e.contactId)
  }
  await upsertPoints(
    db,
    ownerId,
    projectId,
    'pipeline',
    PIPELINE_KEYS.map((key) => ({ key, day, value: counts[key].size })),
  )
  await rollupMonths(db, ownerId, projectId, PIPELINE_KEYS, now)
}

const REVENUE_KEYS = ['mrr', 'revenue', 'customers']
export const wonAsRevenueKey = (projectId: string) => `pipeline_revenue:${projectId}`

/** Does the project take its revenue from Stripe or Mollie? Then won deals never count as revenue. */
export async function hasPaymentSource(db: Db, ownerId: string, projectId: string): Promise<boolean> {
  const rows = await db
    .select({ kind: s.connector.kind })
    .from(s.connector)
    .where(and(eq(s.connector.ownerId, ownerId), eq(s.connector.projectId, projectId), eq(s.connector.enabled, true), inArray(s.connector.kind, ['stripe', 'mollie'])))
  return rows.length > 0
}

/**
 * Won deals as revenue, when he switched that on for a project without Stripe or Mollie: MRR and
 * customers as they stand today, one-off deals as revenue on the day they were won. Counted again
 * from all won deals each time, so moving a deal back takes it out again. Switched off, they go.
 */
export async function recountDeals(db: Db, ownerId: string, projectId: string, now = new Date()): Promise<void> {
  const ours = and(eq(s.metricPoint.projectId, projectId), eq(s.metricPoint.source, 'pipeline'), inArray(s.metricPoint.key, REVENUE_KEYS))
  const on = (await getSetting(db, ownerId, wonAsRevenueKey(projectId))) === '1' && !(await hasPaymentSource(db, ownerId, projectId))
  if (!on) {
    const [any] = await db.select({ id: s.metricPoint.id }).from(s.metricPoint).where(ours).limit(1)
    if (!any) return
    await db.delete(s.metricPoint).where(ours)
    await rebuildMonths(db, ownerId, projectId, REVENUE_KEYS, now)
    return
  }
  const won = await db
    .select({ id: s.contact.id, value: s.contact.dealValue, period: s.contact.dealPeriod })
    .from(s.contact)
    .where(and(eq(s.contact.ownerId, ownerId), eq(s.contact.projectId, projectId), eq(s.contact.status, 'won')))
  const events = won.length
    ? await db
        .select({ contactId: s.contactEvent.contactId, day: s.contactEvent.day })
        .from(s.contactEvent)
        .where(and(inArray(s.contactEvent.contactId, won.map((w) => w.id)), eq(s.contactEvent.status, 'won')))
        .orderBy(desc(s.contactEvent.day))
    : []
  // One-off revenue is counted again from scratch: a deal moved back takes its day's revenue with it.
  await db.delete(s.metricPoint).where(and(eq(s.metricPoint.projectId, projectId), eq(s.metricPoint.source, 'pipeline'), eq(s.metricPoint.key, 'revenue')))
  const today = dayOf(now)
  const r = wonRevenue(won.map((w) => ({ value: w.value, period: w.period, wonOn: events.find((e) => e.contactId === w.id)?.day ?? today })))
  await upsertPoints(db, ownerId, projectId, 'pipeline', [
    { key: 'mrr', day: today, value: r.mrr },
    { key: 'customers', day: today, value: r.customers },
    ...[...r.revenue].map(([day, value]) => ({ key: 'revenue', day, value })),
  ])
  await rebuildMonths(db, ownerId, projectId, REVENUE_KEYS, now)
}
