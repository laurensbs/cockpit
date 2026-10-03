'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { EMAIL } from '@/lib/mailto'
import { CONTACT_STATUSES } from '@/lib/options'
import { normalizeUrl } from '@/lib/urls'
import { actionOwner } from '../session'
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

/** Where a contact stands. An answer is worth the most XP: it is a result, not just effort. */
export async function setContactStatus(contactId: string, status: string): Promise<{ xp: number }> {
  const owner = await actionOwner()
  const parsed = z.enum(CONTACT_STATUSES).safeParse(status)
  if (!parsed.success) return { xp: 0 }
  const db = await getDb()
  const [row] = await db
    .update(s.contact)
    .set({ status: parsed.data, ...(parsed.data === 'sent' || parsed.data === 'replied' ? { lastContactAt: new Date() } : {}) })
    .where(and(eq(s.contact.id, String(contactId)), eq(s.contact.ownerId, owner.userId)))
    .returning({ id: s.contact.id, projectId: s.contact.projectId })
  if (!row) return { xp: 0 }
  let xp = 0
  if (parsed.data === 'replied') xp = await award(db, owner.userId, { kind: 'reply', refId: row.id, projectId: row.projectId })
  else await revoke(db, owner.userId, 'reply', row.id)
  revalidatePath(`/projects/${row.projectId}/contacts`)
  revalidatePath('/')
  return { xp }
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
