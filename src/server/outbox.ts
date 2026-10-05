import 'server-only'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { and, asc, desc, eq, gte, inArray, lte, or } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { EMAIL } from '@/lib/mailto'
import { STOP_STATUSES } from '@/lib/options'
import { allowance, dailyCap, finalBody, inSendWindow, nextFollowupAt } from '@/lib/outbox'
import { getSetting, setSetting } from './settings'
import { fixturesAllowed } from './status'
import { award } from './xp'

// Automatic sending: he approves a mail (and its follow-ups) once; this sends it from his own
// mailbox over SMTP, on weekdays in office hours, one at a time, within his daily cap. A reply or a
// "no" from the contact stops the rest of the sequence.

export interface MailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromName: string
  fromEmail: string
  cap: number
  enabled: boolean
}

export const MAIL_KEYS = ['mail_host', 'mail_port', 'mail_secure', 'mail_user', 'mail_pass', 'mail_from_name', 'mail_from_email', 'mail_cap', 'mail_enabled'] as const

export async function mailConfig(db: Db, ownerId: string): Promise<MailConfig & { ready: boolean }> {
  const v = Object.fromEntries(await Promise.all(MAIL_KEYS.map(async (k) => [k, await getSetting(db, ownerId, k)] as const))) as Record<(typeof MAIL_KEYS)[number], string | null>
  const config: MailConfig = {
    host: v.mail_host ?? '',
    port: Number(v.mail_port) || 587,
    secure: v.mail_secure === '1',
    user: v.mail_user ?? '',
    pass: v.mail_pass ?? '',
    fromName: v.mail_from_name ?? '',
    fromEmail: v.mail_from_email ?? '',
    cap: dailyCap(v.mail_cap),
    enabled: v.mail_enabled === '1',
  }
  return { ...config, ready: Boolean(config.host && config.user && config.pass && EMAIL.test(config.fromEmail)) }
}

/** Tests write the messages to a file instead of a mail server; never in the packaged app. */
const fakeSmtp = () => (fixturesAllowed() ? process.env.COCKPIT_FAKE_SMTP : undefined)
const testFlag = (name: string) => fixturesAllowed() && process.env[name] === '1'
const gapMs = () => (fixturesAllowed() && process.env.COCKPIT_MAIL_GAP_MS ? Number(process.env.COCKPIT_MAIL_GAP_MS) : undefined)

interface Outgoing {
  to: string
  subject: string
  text: string
}

async function deliver(config: MailConfig, mail: Outgoing): Promise<string> {
  const message = {
    from: config.fromName ? { name: config.fromName, address: config.fromEmail } : config.fromEmail,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    headers: { 'List-Unsubscribe': `<mailto:${config.fromEmail}?subject=Afmelden>` },
  }
  const fake = fakeSmtp()
  if (fake) {
    const info = await nodemailer.createTransport({ jsonTransport: true }).sendMail(message)
    mkdirSync(dirname(fake), { recursive: true })
    appendFileSync(fake, `${info.message.toString()}\n`)
    return String(info.messageId)
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
  const info = await transport.sendMail(message)
  return String(info.messageId)
}

/** A short reason for him, never a password. */
function sendError(error: unknown): string {
  const e = error as { code?: string; responseCode?: number; message?: string }
  if (e.code === 'EAUTH' || e.responseCode === 535) return 'De mailserver weigert de inlog: controleer gebruikersnaam en (app-)wachtwoord.'
  if (e.code === 'ECONNECTION' || e.code === 'ETIMEDOUT' || e.code === 'ESOCKET' || e.code === 'EDNS') return 'De mailserver was niet bereikbaar: controleer server en poort.'
  if (e.responseCode && e.responseCode >= 500) return `De mailserver weigerde de mail (${e.responseCode}).`
  return 'Versturen lukte niet.'
}

/** Sends a test mail to his own address, to check the settings. */
export async function sendTestMail(db: Db, ownerId: string): Promise<{ ok: boolean; message: string }> {
  const config = await mailConfig(db, ownerId)
  if (!config.ready) return { ok: false, message: 'Vul eerst server, gebruikersnaam, wachtwoord en afzender in.' }
  try {
    await deliver(config, { to: config.fromEmail, subject: 'Testmail van je Cockpit', text: 'Het werkt: de cockpit kan mails versturen vanaf dit adres.' })
    return { ok: true, message: `Testmail verstuurd naar ${config.fromEmail}.` }
  } catch (error) {
    return { ok: false, message: sendError(error) }
  }
}


/** Stops whatever is still to go out to a contact (a reply, a "no", or he deleted the contact). */
export async function cancelForContact(db: Db, ownerId: string, contactId: string): Promise<number> {
  const rows = await db
    .update(s.emailJob)
    .set({ status: 'cancelled' })
    .where(and(eq(s.emailJob.ownerId, ownerId), eq(s.emailJob.contactId, contactId), inArray(s.emailJob.status, ['queued', 'waiting'])))
    .returning({ id: s.emailJob.id })
  return rows.length
}

export async function cancelSequence(db: Db, ownerId: string, sequenceId: string): Promise<number> {
  const rows = await db
    .update(s.emailJob)
    .set({ status: 'cancelled' })
    .where(and(eq(s.emailJob.ownerId, ownerId), eq(s.emailJob.sequenceId, sequenceId), inArray(s.emailJob.status, ['queued', 'waiting'])))
    .returning({ id: s.emailJob.id })
  return rows.length
}

interface DraftBody {
  subject?: string
  body?: string
  ps?: string
  followups?: { subject?: string; body?: string }[]
}

/**
 * He approves a draft for a contact: the first mail goes in the queue, its follow-ups wait for their
 * turn. Only for a contact with an address and a basis, who has not answered or said no.
 */
export async function scheduleDraft(db: Db, ownerId: string, contentItemId: string, contactId?: string | null): Promise<{ ok: boolean; message: string }> {
  const [item] = await db
    .select()
    .from(s.contentItem)
    .where(and(eq(s.contentItem.id, contentItemId), eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'email')))
  if (!item) return { ok: false, message: 'Dit concept bestaat niet.' }
  const target = contactId ?? item.contactId
  const [contact] = target
    ? await db
        .select()
        .from(s.contact)
        .where(and(eq(s.contact.id, target), eq(s.contact.ownerId, ownerId)))
    : []
  if (!contact) return { ok: false, message: 'Kies eerst voor wie deze mail is.' }
  if (item.projectId && contact.projectId !== item.projectId) return { ok: false, message: 'Dit contact hoort bij een ander project.' }
  if (!contact.email || !EMAIL.test(contact.email)) return { ok: false, message: `${contact.organization} heeft nog geen geldig e-mailadres.` }
  if (STOP_STATUSES.includes(contact.status)) return { ok: false, message: `${contact.organization} heeft al geantwoord of nee gezegd, of je hebt nog geen ja gezegd.` }
  // Cold mail to a business needs consent in Spain and the Netherlands: call first, mail when they ask.
  if (contact.basis === 'business' && (await getSetting(db, ownerId, 'cold_mail_ok')) !== '1') {
    return { ok: false, message: `Koude mail aan bedrijven staat uit. Bel ${contact.organization} eerst; vragen ze om info, tik dan op “Ze willen info”.` }
  }
  const busy = await db
    .select({ id: s.emailJob.id })
    .from(s.emailJob)
    .where(and(eq(s.emailJob.contactId, contact.id), inArray(s.emailJob.status, ['queued', 'waiting'])))
  if (busy.length) return { ok: false, message: `Er staat al een mail voor ${contact.organization} klaar.` }

  const body = item.body as DraftBody
  const subject = (body.subject ?? '').trim()
  if (!subject || !(body.body ?? '').trim()) return { ok: false, message: 'Dit concept heeft geen onderwerp of tekst.' }
  const steps = [
    { subject, text: finalBody(body.body ?? '', body.ps ?? '', item.language) },
    ...(body.followups ?? [])
      .filter((f) => (f.body ?? '').trim())
      .slice(0, 2)
      .map((f) => ({ subject: (f.subject ?? '').trim() || `Re: ${subject}`, text: finalBody(f.body ?? '', '', item.language) })),
  ]
  const sequenceId = crypto.randomUUID()
  const now = new Date()
  await db.insert(s.emailJob).values(
    steps.map((step, i) => ({
      id: crypto.randomUUID(),
      ownerId,
      projectId: item.projectId,
      contactId: contact.id,
      contentItemId: item.id,
      sequenceId,
      step: i,
      toAddress: contact.email!,
      subject: step.subject,
      body: step.text,
      status: i === 0 ? 'queued' : 'waiting',
      sendAfter: i === 0 ? now : null,
    })),
  )
  await db.update(s.contentItem).set({ status: 'planned', contactId: contact.id }).where(eq(s.contentItem.id, item.id))
  return { ok: true, message: steps.length > 1 ? `In de wachtrij, met ${steps.length - 1} opvolgmail${steps.length > 2 ? 's' : ''}.` : 'In de wachtrij.' }
}

export interface OutboxRun {
  sent: number
  failed: number
  skipped?: 'not-configured' | 'paused' | 'window' | 'cap'
}

/** Sends what is due, within the rules. Called every two minutes by the server, and by the button. */
export async function runOutbox(db: Db, ownerId: string, now = new Date()): Promise<OutboxRun> {
  const config = await mailConfig(db, ownerId)
  if (!config.ready) return { sent: 0, failed: 0, skipped: 'not-configured' }
  if (!config.enabled) return { sent: 0, failed: 0, skipped: 'paused' }
  if (!testFlag('COCKPIT_MAIL_ANYTIME') && !inSendWindow(now)) return { sent: 0, failed: 0, skipped: 'window' }
  const recent = await db
    .select({ sentAt: s.emailJob.sentAt })
    .from(s.emailJob)
    .where(and(eq(s.emailJob.ownerId, ownerId), eq(s.emailJob.status, 'sent'), gte(s.emailJob.sentAt, new Date(now.getTime() - 36 * 3_600_000))))
    .orderBy(desc(s.emailJob.sentAt))
  const today = dayOf(now)
  const sentToday = recent.filter((r) => r.sentAt && dayOf(r.sentAt) === today).length
  const n = allowance({ sentToday, cap: config.cap, lastSentAt: recent[0]?.sentAt ?? null, now, gapMs: gapMs() })
  if (n === 0) return { sent: 0, failed: 0, skipped: sentToday >= config.cap ? 'cap' : undefined }
  const due = await db
    .select()
    .from(s.emailJob)
    .where(and(eq(s.emailJob.ownerId, ownerId), eq(s.emailJob.status, 'queued'), or(lte(s.emailJob.sendAfter, now))))
    .orderBy(asc(s.emailJob.sendAfter), asc(s.emailJob.step), asc(s.emailJob.createdAt))
    .limit(n)
  let sent = 0
  let failed = 0
  for (const job of due) {
    const [contact] = job.contactId ? await db.select().from(s.contact).where(eq(s.contact.id, job.contactId)) : []
    if (!contact || STOP_STATUSES.includes(contact.status) || contact.email !== job.toAddress) {
      await cancelSequence(db, ownerId, job.sequenceId)
      continue
    }
    try {
      const messageId = await deliver(config, { to: job.toAddress, subject: job.subject, text: job.body })
      const sentAt = new Date()
      await db.update(s.emailJob).set({ status: 'sent', sentAt, messageId, error: null }).where(eq(s.emailJob.id, job.id))
      const next = nextFollowupAt(job.step, sentAt)
      if (next) {
        await db
          .update(s.emailJob)
          .set({ status: 'queued', sendAfter: next })
          .where(and(eq(s.emailJob.sequenceId, job.sequenceId), eq(s.emailJob.step, job.step + 1), eq(s.emailJob.status, 'waiting')))
      }
      await db
        .update(s.contact)
        .set({ status: contact.status === 'new' || contact.status === 'drafted' ? 'sent' : contact.status, lastContactAt: sentAt })
        .where(eq(s.contact.id, contact.id))
      if (job.step === 0 && job.contentItemId) {
        await db.update(s.contentItem).set({ status: 'done', doneAt: sentAt }).where(eq(s.contentItem.id, job.contentItemId))
        await award(db, ownerId, { kind: 'email', refId: job.contentItemId, projectId: job.projectId })
      }
      sent++
    } catch (error) {
      failed++
      await db.update(s.emailJob).set({ status: 'failed', error: sendError(error) }).where(eq(s.emailJob.id, job.id))
    }
  }
  if (sent || failed) await setSetting(db, ownerId, 'mail_last_run', now.toISOString())
  return { sent, failed }
}

/** A failed mail goes back in the queue. */
export async function retryJob(db: Db, ownerId: string, jobId: string): Promise<void> {
  await db
    .update(s.emailJob)
    .set({ status: 'queued', error: null, sendAfter: new Date() })
    .where(and(eq(s.emailJob.id, jobId), eq(s.emailJob.ownerId, ownerId), eq(s.emailJob.status, 'failed')))
}
