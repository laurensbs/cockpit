import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { PIPELINE_METRICS } from '@/lib/options'
import { rollupMonths, upsertPoints } from './points'

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
