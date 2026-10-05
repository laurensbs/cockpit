'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb, type Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { EMAIL } from '@/lib/mailto'
import { launchPrompt, runHeadless } from '../claude'
import { createTicket } from '../mcp/tickets'
import { cancelForContact, scheduleDraft } from '../outbox'
import { actionOwner } from '../session'
import { award } from '../xp'

// His yes or no on a business Claude found (Prospectie), and the switch per project. Claude prepares,
// he decides: yes puts a call (or visit) on his quests, no means never again, and the mail only goes
// once they asked for information on the phone.

const REASONS = ['past niet', 'klopt niet wat Claude zag', 'te groot', 'te ver weg', 'anders'] as const

async function ownContact(db: Db, ownerId: string, id: string) {
  const [contact] = await db
    .select()
    .from(s.contact)
    .where(and(eq(s.contact.id, String(id)), eq(s.contact.ownerId, ownerId)))
  return contact ?? null
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}/contacts`)
  revalidatePath('/quests')
  revalidatePath('/')
}

const STEP: Record<string, string> = { call: 'Bel', visit: 'Loop langs bij', form: 'Vul het formulier in bij', email: 'Bel' }

/** Yes: the business becomes a contact, and the call (or visit) is on his quest list for today. */
export async function acceptProspect(contactId: string): Promise<{ ok: boolean; message: string; xp?: number }> {
  const owner = await actionOwner()
  const db = await getDb()
  const contact = await ownContact(db, owner.userId, contactId)
  if (!contact || contact.status !== 'prospect') return { ok: false, message: 'Dit voorstel staat er niet meer.' }
  await db.update(s.contact).set({ status: 'new' }).where(eq(s.contact.id, contact.id))
  const verb = STEP[contact.channel] ?? 'Bel'
  const detail = [
    contact.phone ? `Telefoon: ${contact.phone}` : 'Geen telefoonnummer gevonden: kijk op hun site.',
    contact.city ? `Plaats: ${contact.city}` : '',
    contact.website ? `Site: ${contact.website}` : '',
    contact.observation ? `Wat Claude zag: ${contact.observation}` : '',
    contact.pitch ? `Zo kun je openen: ${contact.pitch}` : '',
    'Willen ze info? Tik in Cockpit bij het contact op “Ze willen info”: dan gaat de mail die Claude klaarzette.',
  ]
    .filter(Boolean)
    .join('\n')
  await db
    .insert(s.quest)
    .values({
      id: crypto.randomUUID(),
      ownerId: owner.userId,
      projectId: contact.projectId,
      title: `${verb} ${contact.organization}`.slice(0, 120),
      detail: detail.slice(0, 2000),
      kind: 'custom',
      xp: 25,
      source: 'prospect',
      sourceKey: `prospect:${contact.id}`,
      dueOn: dayOf(new Date()),
    })
    .onConflictDoNothing()
  const xp = await award(db, owner.userId, { kind: 'decide', refId: `prospect:${contact.id}`, projectId: contact.projectId })
  refresh(contact.projectId)
  return { ok: true, message: `${verb} ${contact.organization} staat bij je quests van vandaag.`, xp }
}

/** No: never proposed again. The reason teaches Claude what to look for next time. */
export async function skipProspect(contactId: string, reason: string): Promise<{ ok: boolean; message: string; xp?: number }> {
  const owner = await actionOwner()
  const db = await getDb()
  const contact = await ownContact(db, owner.userId, contactId)
  if (!contact) return { ok: false, message: 'Dit voorstel staat er niet meer.' }
  const why = (REASONS as readonly string[]).includes(reason) ? reason : 'anders'
  await db
    .update(s.contact)
    .set({ status: 'skipped', note: `${contact.note}${contact.note ? ' · ' : ''}Nee van Laurens: ${why}`.slice(0, 1000) })
    .where(eq(s.contact.id, contact.id))
  await db
    .update(s.contentItem)
    .set({ status: 'archived' })
    .where(and(eq(s.contentItem.contactId, contact.id), eq(s.contentItem.status, 'draft')))
  await cancelForContact(db, owner.userId, contact.id)
  const xp = await award(db, owner.userId, { kind: 'decide', refId: `prospect:${contact.id}`, projectId: contact.projectId })
  refresh(contact.projectId)
  return { ok: true, message: `${contact.organization} komt niet meer terug.`, xp }
}

/**
 * They asked for information on the phone: now mailing them is allowed (they asked), so the mail Claude
 * prepared goes in the queue. An address they gave on the phone replaces the one from their site.
 */
export async function prospectWantsInfo(contactId: string, email: string): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const db = await getDb()
  const contact = await ownContact(db, owner.userId, contactId)
  if (!contact) return { ok: false, message: 'Dit contact bestaat niet meer.' }
  const address = email.trim() || contact.email || ''
  if (!EMAIL.test(address)) return { ok: false, message: 'Vul het e-mailadres in dat ze je gaven.' }
  await db
    .update(s.contact)
    .set({ email: address, basis: 'consent', status: contact.status === 'new' || contact.status === 'prospect' ? 'drafted' : contact.status, lastContactAt: new Date() })
    .where(eq(s.contact.id, contact.id))
  const [draft] = await db
    .select({ id: s.contentItem.id })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.contactId, contact.id), eq(s.contentItem.kind, 'email'), eq(s.contentItem.status, 'draft')))
    .orderBy(desc(s.contentItem.createdAt))
    .limit(1)
  refresh(contact.projectId)
  if (!draft) return { ok: true, message: 'Bewaard. Er is nog geen mail klaar: laat Claude er een schrijven.' }
  return scheduleDraft(db, owner.userId, draft.id, contact.id)
}

/** How many businesses Claude looks for each working day for this project (0 = off). */
export async function setProspecting(projectId: string, perDay: number): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const n = z.coerce.number().int().min(0).max(10).safeParse(perDay)
  if (!n.success) return { ok: false, message: 'Kies 0 tot 10 per dag.' }
  const db = await getDb()
  const [project] = await db
    .select()
    .from(s.project)
    .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
  if (!project) return { ok: false, message: 'Dat project bestaat niet.' }
  if (n.data > 0 && /marketing staat uit/i.test(`${project.what} ${project.redLines}`)) return { ok: false, message: `Voor ${project.name} staat marketing uit.` }
  await db.update(s.project).set({ prospectPerDay: n.data }).where(eq(s.project.id, project.id))
  refresh(project.id)
  return { ok: true, message: n.data ? `Claude zoekt elke werkdag ${n.data} bedrijven voor ${project.name}.` : `Prospectie staat uit voor ${project.name}.` }
}

/** "Zoek nu": Claude looks for businesses right away, in the background; the proposals appear on the page. */
export async function prospectNow(projectId: string, count: number): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const db = await getDb()
  const [project] = await db
    .select()
    .from(s.project)
    .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
  if (!project) return { ok: false, message: 'Dat project bestaat niet.' }
  if (/marketing staat uit/i.test(`${project.what} ${project.redLines}`)) return { ok: false, message: `Voor ${project.name} staat marketing uit.` }
  const n = Math.min(10, Math.max(1, Math.round(Number(count) || 5)))
  const ticket = createTicket({ task: 'prospect', projectId: project.id, options: { count: n } })
  const { started } = await runHeadless(launchPrompt(ticket), { web: true })
  return started
    ? { ok: true, message: `Claude zoekt nu ${n} bedrijven op de achtergrond. Dat duurt een paar minuten; de voorstellen verschijnen hier vanzelf.` }
    : { ok: false, message: 'Claude Code kon niet starten. Staat het geïnstalleerd en ben je ingelogd?' }
}
