import 'server-only'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { inSendWindow } from '@/lib/outbox'
import { mailConfig } from './outbox'

export interface MailStatus {
  ready: boolean
  enabled: boolean
  cap: number
  sentToday: number
  queued: number
  failed: number
  inWindow: boolean
  fromEmail: string
}

/** Is automatic sending set up, and how is today going. */
export async function mailStatus(db: Db, ownerId: string, now = new Date()): Promise<MailStatus> {
  const config = await mailConfig(db, ownerId)
  const jobs = await db
    .select({ status: s.emailJob.status, sentAt: s.emailJob.sentAt })
    .from(s.emailJob)
    .where(and(eq(s.emailJob.ownerId, ownerId), inArray(s.emailJob.status, ['queued', 'failed', 'sent']), gte(s.emailJob.createdAt, new Date(now.getTime() - 60 * 86_400_000))))
  const today = dayOf(now)
  return {
    ready: config.ready,
    enabled: config.enabled,
    cap: config.cap,
    sentToday: jobs.filter((j) => j.status === 'sent' && j.sentAt && dayOf(j.sentAt) === today).length,
    queued: jobs.filter((j) => j.status === 'queued').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
    inWindow: inSendWindow(now),
    fromEmail: config.fromEmail,
  }
}

export interface OutboxRow {
  id: string
  sequenceId: string
  step: number
  to: string
  organization: string | null
  subject: string
  status: string
  sendAfter: Date | null
  sentAt: Date | null
  error: string | null
  contentItemId: string | null
}

/** The queue and what went out, for one project or all of them. */
export async function outboxRows(db: Db, ownerId: string, projectId?: string, limit = 100): Promise<OutboxRow[]> {
  const rows = await db
    .select({ job: s.emailJob, organization: s.contact.organization })
    .from(s.emailJob)
    .leftJoin(s.contact, eq(s.contact.id, s.emailJob.contactId))
    .where(and(eq(s.emailJob.ownerId, ownerId), ...(projectId ? [eq(s.emailJob.projectId, projectId)] : [])))
    .orderBy(desc(s.emailJob.createdAt), s.emailJob.step)
    .limit(limit)
  return rows.map(({ job, organization }) => ({
    id: job.id,
    sequenceId: job.sequenceId,
    step: job.step,
    to: job.toAddress,
    organization,
    subject: job.subject,
    status: job.status,
    sendAfter: job.sendAfter,
    sentAt: job.sentAt,
    error: job.error,
    contentItemId: job.contentItemId,
  }))
}

export type QueueState = { status: 'queued' | 'sent' | 'failed' | 'cancelled'; label: string } | null

const time = (d: Date) => d.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Where each draft stands in the queue: its first mail decides. */
export function queueByItem(rows: OutboxRow[]): Map<string, QueueState> {
  const map = new Map<string, QueueState>()
  for (const row of rows) {
    if (row.step !== 0 || !row.contentItemId || map.has(row.contentItemId)) continue
    const followups = rows.filter((r) => r.sequenceId === row.sequenceId && r.step > 0)
    const pending = followups.filter((r) => r.status === 'queued' || r.status === 'waiting').length
    if (row.status === 'sent') map.set(row.contentItemId, { status: 'sent', label: `Verstuurd ${time(row.sentAt!)}${pending ? ` · ${pending} opvolgmail${pending === 1 ? '' : 's'} gepland` : ''}` })
    else if (row.status === 'queued') map.set(row.contentItemId, { status: 'queued', label: `In de wachtrij${followups.length ? `, met ${followups.length} opvolgmail${followups.length === 1 ? '' : 's'}` : ''}` })
    else if (row.status === 'failed') map.set(row.contentItemId, { status: 'failed', label: row.error ?? 'Versturen lukte niet.' })
    else map.set(row.contentItemId, { status: 'cancelled', label: 'Gestopt' })
  }
  return map
}

export const outboxTime = time
