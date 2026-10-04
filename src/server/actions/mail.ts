'use server'

import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { EMAIL } from '@/lib/mailto'
import { MAX_DAILY_CAP } from '@/lib/outbox'
import { cancelSequence, retryJob, runOutbox, scheduleDraft, sendTestMail } from '../outbox'
import { actionOwner } from '../session'
import { getSetting, setSetting } from '../settings'
import type { FormState } from './types'

const mailSchema = z.object({
  host: z
    .string()
    .trim()
    .max(200)
    .regex(/^[A-Za-z0-9.-]*$/),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().trim().max(200),
  pass: z.string().max(300),
  fromName: z.string().trim().max(80),
  fromEmail: z.string().trim().max(200),
  cap: z.coerce.number().int().min(1).max(MAX_DAILY_CAP),
  enabled: z.boolean(),
})

/** His own mailbox: where mails go out from. An empty password field keeps the stored one. */
export async function saveMailSettings(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = mailSchema.safeParse({
    host: form.get('host') ?? '',
    port: form.get('port') ?? 587,
    secure: form.get('secure') === '1',
    user: form.get('user') ?? '',
    pass: form.get('pass') ?? '',
    fromName: form.get('fromName') ?? '',
    fromEmail: form.get('fromEmail') ?? '',
    cap: form.get('cap') ?? 20,
    enabled: form.get('enabled') === '1',
  })
  if (!parsed.success) return { ok: false, error: 'Controleer de velden: server, poort en limiet (1–50).' }
  const m = parsed.data
  if (m.fromEmail && !EMAIL.test(m.fromEmail)) return { ok: false, error: 'Het afzenderadres klopt niet.' }
  const db = await getDb()
  const id = owner.userId
  const stored = await getSetting(db, id, 'mail_pass')
  if (m.enabled && !(m.host && m.user && (m.pass || stored) && m.fromEmail)) return { ok: false, error: 'Vul eerst alles in voordat je automatisch versturen aanzet.' }
  await setSetting(db, id, 'mail_host', m.host)
  await setSetting(db, id, 'mail_port', String(m.port))
  await setSetting(db, id, 'mail_secure', m.secure ? '1' : '0')
  await setSetting(db, id, 'mail_user', m.user)
  if (m.pass) await setSetting(db, id, 'mail_pass', m.pass)
  await setSetting(db, id, 'mail_from_name', m.fromName)
  await setSetting(db, id, 'mail_from_email', m.fromEmail)
  await setSetting(db, id, 'mail_cap', String(m.cap))
  await setSetting(db, id, 'mail_enabled', m.enabled ? '1' : '0')
  revalidatePath('/settings')
  return { ok: true, message: m.enabled ? 'Bewaard. Automatisch versturen staat aan.' : 'Bewaard. Automatisch versturen staat uit.' }
}

export async function testMail(): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  return sendTestMail(await getDb(), owner.userId)
}

/** He approves one draft: it goes out on its own, with its follow-ups. */
export async function scheduleEmail(contentItemId: string, contactId?: string | null): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const db = await getDb()
  const result = await scheduleDraft(db, owner.userId, String(contentItemId), contactId ? String(contactId) : null)
  revalidatePath('/studio')
  revalidatePath('/projects', 'layout')
  return result
}

/** Every personal draft of a project that is ready (an address, no answer yet) goes in the queue at once. */
export async function scheduleAllDrafts(projectId: string): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const db = await getDb()
  const drafts = await db
    .select({ id: s.contentItem.id, contactId: s.contentItem.contactId })
    .from(s.contentItem)
    .innerJoin(s.contact, eq(s.contact.id, s.contentItem.contactId))
    .where(
      and(
        eq(s.contentItem.ownerId, owner.userId),
        eq(s.contentItem.projectId, String(projectId)),
        eq(s.contentItem.kind, 'email'),
        eq(s.contentItem.status, 'draft'),
        notInArray(s.contact.status, ['replied', 'no']),
      ),
    )
  // One sequence per contact: the newest draft wins.
  const seen = new Set<string>()
  let queued = 0
  const problems: string[] = []
  for (const d of drafts.reverse()) {
    if (!d.contactId || seen.has(d.contactId)) continue
    seen.add(d.contactId)
    const r = await scheduleDraft(db, owner.userId, d.id)
    if (r.ok) queued++
    else problems.push(r.message)
  }
  revalidatePath(`/projects/${projectId}/contacts`)
  revalidatePath('/studio')
  if (!queued) return { ok: false, message: problems[0] ?? 'Geen concepten die klaarstaan.' }
  return { ok: true, message: `${queued} mail${queued === 1 ? '' : 's'} in de wachtrij${problems.length ? `; ${problems.length} overgeslagen` : ''}.` }
}

export async function cancelMail(sequenceId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  await cancelSequence(db, owner.userId, String(sequenceId))
  // A draft that no longer goes out is a draft again.
  await db
    .update(s.contentItem)
    .set({ status: 'draft' })
    .where(
      and(
        eq(s.contentItem.ownerId, owner.userId),
        eq(s.contentItem.status, 'planned'),
        inArray(s.contentItem.id, db.select({ id: s.emailJob.contentItemId }).from(s.emailJob).where(eq(s.emailJob.sequenceId, String(sequenceId)))),
      ),
    )
  revalidatePath('/studio')
  revalidatePath('/projects', 'layout')
}

export async function retryMail(jobId: string): Promise<void> {
  const owner = await actionOwner()
  await retryJob(await getDb(), owner.userId, String(jobId))
  revalidatePath('/studio')
}

export async function runOutboxNow(): Promise<{ sent: number; failed: number; skipped?: string }> {
  const owner = await actionOwner()
  const result = await runOutbox(await getDb(), owner.userId)
  revalidatePath('/studio')
  return result
}
