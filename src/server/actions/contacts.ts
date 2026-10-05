'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { EMAIL } from '@/lib/mailto'
import { ANSWERED_STATUSES, CONTACT_STATUSES, isStopped } from '@/lib/options'
import { normalizeUrl } from '@/lib/urls'
import { cancelForContact } from '../outbox'
import { recordStage, recountDeals, wonAsRevenueKey } from '../pipeline'
import { actionOwner } from '../session'
import { setSetting } from '../settings'
import { award, revoke } from '../xp'
import type { FormState } from './types'

const contactSchema = z.object({
  projectId: z.string().min(1).max(64),
  organization: z.string().trim().min(1).max(120),
  name: z.string().trim().max(80),
  email: z.string().trim().max(160),
  website: z.string().trim().max(300),
  note: z.string().trim().max(1000),
  basis: z.enum(['business', 'relation', 'consent']),
})

export async function saveContact(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = contactSchema.safeParse({
    projectId: form.get('projectId'),
    organization: form.get('organization'),
    name: form.get('name') ?? '',
    email: form.get('email') ?? '',
    website: form.get('website') ?? '',
    note: form.get('note') ?? '',
    basis: form.get('basis') ?? 'business',
  })
  if (!parsed.success) return { ok: false, error: 'Een organisatie is nodig.' }
  const c = parsed.data
  if (c.email && !EMAIL.test(c.email)) return { ok: false, error: 'Dat e-mailadres klopt niet.' }
  const website = c.website ? normalizeUrl(c.website) : null
  if (c.website && !website) return { ok: false, error: 'Dat webadres klopt niet.' }
  const db = await getDb()
  const [project] = await db
    .select({ id: s.project.id })
    .from(s.project)
    .where(and(eq(s.project.id, c.projectId), eq(s.project.ownerId, owner.userId)))
  if (!project) return { ok: false, error: 'Dat project bestaat niet.' }
  await db.insert(s.contact).values({
    id: crypto.randomUUID(),
    ownerId: owner.userId,
    projectId: c.projectId,
    organization: c.organization,
    name: c.name,
    email: c.email || null,
    website,
    note: c.note,
    basis: c.basis,
  })
  revalidatePath(`/projects/${c.projectId}/contacts`)
  return { ok: true, message: 'Contact toegevoegd.' }
}

/**
 * Where a contact stands. An answer is worth the most XP (a result, not just effort) and stays earned
 * as the contact moves on to a meeting, an offer or a deal; a won deal is worth more on top.
 */
export async function setContactStatus(contactId: string, status: string): Promise<{ xp: number }> {
  const owner = await actionOwner()
  const parsed = z.enum(CONTACT_STATUSES).safeParse(status)
  if (!parsed.success) return { xp: 0 }
  const db = await getDb()
  const next = parsed.data
  const [row] = await db
    .update(s.contact)
    .set({ status: next, ...(next === 'sent' || next === 'replied' ? { lastContactAt: new Date() } : {}) })
    .where(and(eq(s.contact.id, String(contactId)), eq(s.contact.ownerId, owner.userId)))
    .returning({ id: s.contact.id, projectId: s.contact.projectId })
  if (!row) return { xp: 0 }
  // An answer or a "no" stops whatever was still to go out to them.
  if (isStopped(next)) await cancelForContact(db, owner.userId, row.id)
  let xp = 0
  if (ANSWERED_STATUSES.includes(next)) xp += await award(db, owner.userId, { kind: 'reply', refId: row.id, projectId: row.projectId })
  else await revoke(db, owner.userId, 'reply', row.id)
  if (next === 'won') xp += await award(db, owner.userId, { kind: 'deal', refId: row.id, projectId: row.projectId })
  else await revoke(db, owner.userId, 'deal', row.id)
  await recordStage(db, owner.userId, row, next)
  await recountDeals(db, owner.userId, row.projectId)
  revalidatePath(`/projects/${row.projectId}/contacts`)
  revalidatePath(`/projects/${row.projectId}`)
  revalidatePath('/')
  return { xp }
}

const dealSchema = z.object({
  contactId: z.string().min(1).max(64),
  value: z.string().trim().max(12),
  period: z.enum(['month', 'once']),
  nextStep: z.string().trim().max(160),
  nextStepOn: z.string().trim().max(10),
})

/** What a deal is worth and what happens next: the pipeline's own numbers. */
export async function saveDeal(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = dealSchema.safeParse({
    contactId: form.get('contactId'),
    value: form.get('value') ?? '',
    period: form.get('period') ?? 'month',
    nextStep: form.get('nextStep') ?? '',
    nextStepOn: form.get('nextStepOn') ?? '',
  })
  if (!parsed.success) return { ok: false, error: 'Dat klopt niet helemaal.' }
  const d = parsed.data
  const value = d.value ? Math.round(Number(d.value.replace(/[€\s.]/g, '').replace(',', '.'))) : null
  if (d.value && (value == null || !Number.isFinite(value) || value < 0 || value > 10_000_000)) return { ok: false, error: 'De waarde is een bedrag in euro’s.' }
  if (d.nextStepOn && !/^\d{4}-\d{2}-\d{2}$/.test(d.nextStepOn)) return { ok: false, error: 'Kies een datum voor de volgende stap.' }
  const db = await getDb()
  const [row] = await db
    .update(s.contact)
    .set({ dealValue: value, dealPeriod: value == null ? null : d.period, nextStep: d.nextStep, nextStepOn: d.nextStepOn || null })
    .where(and(eq(s.contact.id, d.contactId), eq(s.contact.ownerId, owner.userId)))
    .returning({ projectId: s.contact.projectId })
  if (!row) return { ok: false, error: 'Dit contact bestaat niet.' }
  await recountDeals(db, owner.userId, row.projectId)
  revalidatePath(`/projects/${row.projectId}/contacts`)
  return { ok: true, message: 'Bewaard.' }
}

export async function deleteContact(contactId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [row] = await db
    .delete(s.contact)
    .where(and(eq(s.contact.id, String(contactId)), eq(s.contact.ownerId, owner.userId)))
    .returning({ projectId: s.contact.projectId })
  if (row) revalidatePath(`/projects/${row.projectId}/contacts`)
}

/** "Gewonnen telt als omzet": won deals become MRR, revenue and customers (never over Stripe or Mollie). */
export async function setWonAsRevenue(projectId: string, on: boolean): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [project] = await db
    .select({ id: s.project.id })
    .from(s.project)
    .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
  if (!project) return
  await setSetting(db, owner.userId, wonAsRevenueKey(project.id), on ? '1' : null)
  await recountDeals(db, owner.userId, project.id)
  revalidatePath(`/projects/${project.id}/contacts`)
  revalidatePath(`/projects/${project.id}/numbers`)
  revalidatePath(`/projects/${project.id}`)
}
