'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb, type Db } from '@/db'
import * as s from '@/db/schema'
import { safeLink } from '@/lib/ai/schemas'
import { addDays, dayOf } from '@/lib/dates'
import { experimentActual, experimentBaseline, experimentDays } from '@/lib/experiments'
import { isMetricKey, METRIC_DEFS } from '@/lib/metrics'
import { dailySeries, loadPoints } from '../points'
import { actionOwner } from '../session'
import { award, revoke } from '../xp'

async function own(db: Db, ownerId: string, id: string) {
  const [item] = await db
    .select()
    .from(s.contentItem)
    .where(and(eq(s.contentItem.id, String(id)), eq(s.contentItem.ownerId, ownerId)))
  return item ?? null
}

function refresh(projectId: string | null) {
  revalidatePath('/studio')
  revalidatePath('/')
  if (projectId) {
    revalidatePath(`/projects/${projectId}/contacts`)
    revalidatePath(`/projects/${projectId}/numbers`)
  }
}

/** Posted or sent (by him, elsewhere): XP in. Unticked: XP out again. */
export async function markContentDone(id: string, done: boolean): Promise<{ xp: number }> {
  const owner = await actionOwner()
  const db = await getDb()
  const item = await own(db, owner.userId, id)
  if (!item || (item.kind !== 'social' && item.kind !== 'email' && item.kind !== 'article')) return { xp: 0 }
  // A published article counts as a post: content that went out.
  const kind = item.kind === 'email' ? 'email' : 'post'
  await db
    .update(s.contentItem)
    .set({ status: done ? 'done' : 'draft', doneAt: done ? new Date() : null })
    .where(eq(s.contentItem.id, item.id))
  let xp = 0
  if (done) xp = await award(db, owner.userId, { kind, refId: item.id, projectId: item.projectId })
  else await revoke(db, owner.userId, kind, item.id)
  if (done && item.contactId) {
    await db
      .update(s.contact)
      .set({ status: 'sent', lastContactAt: new Date() })
      .where(and(eq(s.contact.id, item.contactId), eq(s.contact.ownerId, owner.userId)))
  }
  refresh(item.projectId)
  return { xp }
}

/** "Help iemand" done: he gave something of value in that place today (an answer, a tip, no pitch). */
export async function gaveValue(id: string): Promise<{ xp: number }> {
  const owner = await actionOwner()
  const db = await getDb()
  const item = await own(db, owner.userId, id)
  if (!item || item.kind !== 'opportunity') return { xp: 0 }
  const xp = await award(db, owner.userId, { kind: 'give', refId: `${item.id}:${dayOf(new Date())}`, projectId: item.projectId })
  refresh(item.projectId)
  return { xp }
}

/** Thumbs up or down: the AI reads these the next time it makes something for this project. */
export async function rateContent(id: string, rating: number): Promise<void> {
  const owner = await actionOwner()
  const value = rating > 0 ? 1 : rating < 0 ? -1 : 0
  const db = await getDb()
  const [row] = await db
    .update(s.contentItem)
    .set({ rating: value })
    .where(and(eq(s.contentItem.id, String(id)), eq(s.contentItem.ownerId, owner.userId)))
    .returning({ projectId: s.contentItem.projectId })
  if (row) refresh(row.projectId)
}

export async function archiveContent(id: string, archived = true): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [row] = await db
    .update(s.contentItem)
    .set({ status: archived ? 'archived' : 'draft' })
    .where(and(eq(s.contentItem.id, String(id)), eq(s.contentItem.ownerId, owner.userId)))
    .returning({ projectId: s.contentItem.projectId })
  if (row) refresh(row.projectId)
}

/** Puts a post (or a mail) on a day in the calendar, or takes it off. */
export async function planContent(id: string, day: string | null): Promise<void> {
  const owner = await actionOwner()
  if (day !== null && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return
  const db = await getDb()
  const [row] = await db
    .update(s.contentItem)
    .set({ plannedFor: day, status: day ? 'planned' : 'draft' })
    .where(and(eq(s.contentItem.id, String(id)), eq(s.contentItem.ownerId, owner.userId), eq(s.contentItem.status, day ? 'draft' : 'planned')))
    .returning({ projectId: s.contentItem.projectId })
  if (row) refresh(row.projectId)
}

/** An idea or an opportunity becomes a quest for the coming week. */
export async function contentToQuest(id: string): Promise<{ added: boolean }> {
  const owner = await actionOwner()
  const db = await getDb()
  const item = await own(db, owner.userId, id)
  if (!item || (item.kind !== 'idea' && item.kind !== 'opportunity')) return { added: false }
  const body = item.body as { firstStep?: string; howToApproach?: string; effort?: number; why?: string }
  const effort = Number(body.effort ?? 3)
  const rows = await db
    .insert(s.quest)
    .values({
      id: crypto.randomUUID(),
      ownerId: owner.userId,
      projectId: item.projectId,
      title: item.kind === 'idea' ? item.title : `Kans: ${item.title}`,
      detail: (item.kind === 'idea' ? body.firstStep : body.howToApproach) ?? '',
      kind: 'custom',
      xp: effort <= 2 ? 10 : effort >= 4 ? 50 : 25,
      source: 'ai',
      sourceKey: `content:${item.id}`,
      dueOn: addDays(dayOf(new Date()), 7),
    })
    .onConflictDoNothing()
    .returning({ id: s.quest.id })
  revalidatePath('/quests')
  refresh(item.projectId)
  return { added: rows.length > 0 }
}

/** An organisation found on the web goes into the project's contacts (an address is added by hand). */
export async function opportunityToContact(id: string): Promise<{ contactId: string | null }> {
  const owner = await actionOwner()
  const db = await getDb()
  const item = await own(db, owner.userId, id)
  if (!item || item.kind !== 'opportunity' || !item.projectId) return { contactId: null }
  const body = item.body as { url?: string | null; howToApproach?: string; why?: string }
  const contactId = crypto.randomUUID()
  await db.insert(s.contact).values({
    id: contactId,
    ownerId: owner.userId,
    projectId: item.projectId,
    organization: item.title,
    website: body.url ? safeLink(body.url) : null,
    note: [body.why, body.howToApproach].filter(Boolean).join(' '),
    basis: 'business',
  })
  await db.update(s.contentItem).set({ status: 'done', doneAt: new Date() }).where(eq(s.contentItem.id, item.id))
  refresh(item.projectId)
  return { contactId }
}

/** A growth experiment moves on the board: from the backlog to running. */
/** The daily values of one metric of a project, for measuring an experiment. */
async function seriesFor(db: Db, ownerId: string, projectId: string | null, key: string, today: string) {
  if (!projectId || !isMetricKey(key)) return null
  const rows = await loadPoints(db, ownerId, addDays(today, -120), { projectIds: [projectId], keys: [key] })
  return { def: METRIC_DEFS[key], daily: dailySeries(rows, projectId, key) }
}

/** Starts an experiment; one tied to a metric remembers where that metric stood, and when to measure. */
export async function startExperiment(id: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const item = await own(db, owner.userId, id)
  if (!item || item.kind !== 'experiment') return
  const body = item.body as Record<string, unknown>
  const today = dayOf(new Date())
  const days = experimentDays(body.days)
  const series = await seriesFor(db, owner.userId, item.projectId, String(body.metricKey ?? ''), today)
  const measured = series ? { startedOn: today, endsOn: addDays(today, days), days, baseline: experimentBaseline(series.def, series.daily, today, days) } : { startedOn: today, endsOn: addDays(today, days), days }
  await db
    .update(s.contentItem)
    .set({ status: 'planned', body: { ...body, ...measured } })
    .where(eq(s.contentItem.id, item.id))
  refresh(item.projectId)
}

/** An experiment is done, won or lost, with what he learned: that learning goes into the next round. */
export async function finishExperiment(id: string, result: string, learning: string): Promise<{ xp: number }> {
  const owner = await actionOwner()
  const parsed = z.object({ result: z.enum(['won', 'lost']), learning: z.string().trim().max(400) }).safeParse({ result, learning })
  if (!parsed.success) return { xp: 0 }
  const db = await getDb()
  const item = await own(db, owner.userId, id)
  if (!item || item.kind !== 'experiment') return { xp: 0 }
  const body = item.body as Record<string, unknown>
  const today = dayOf(new Date())
  // A measured experiment keeps what the numbers did during it.
  const series = typeof body.startedOn === 'string' ? await seriesFor(db, owner.userId, item.projectId, String(body.metricKey ?? ''), today) : null
  const actual = series ? experimentActual(series.def, series.daily, String(body.startedOn), String(body.endsOn ?? today), today) : null
  const baseline = typeof body.baseline === 'number' ? body.baseline : null
  const measured = series ? { actual, lift: actual != null && baseline != null ? actual - baseline : null } : {}
  await db
    .update(s.contentItem)
    .set({ status: 'done', doneAt: new Date(), body: { ...body, ...measured, result: parsed.data.result, learning: parsed.data.learning } })
    .where(eq(s.contentItem.id, item.id))
  // The lesson: what came out, kept for every brief Claude gets about this project.
  await db.insert(s.contentItem).values({
    id: crypto.randomUUID(),
    ownerId: owner.userId,
    projectId: item.projectId,
    kind: 'lesson',
    channel: 'experiment',
    title: item.title,
    status: 'done',
    doneAt: new Date(),
    body: { source: 'experiment', refId: item.id, result: parsed.data.result, learning: parsed.data.learning, metricKey: body.metricKey ?? null, baseline, actual: measured.actual ?? null, days: body.days ?? null },
  })
  const xp = await award(db, owner.userId, { kind: 'experiment', refId: item.id, projectId: item.projectId })
  refresh(item.projectId)
  return { xp }
}
