import 'server-only'
import { and, eq, inArray, ne } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayOf, monthStart, weekStart } from '@/lib/dates'
import { isStopped } from '@/lib/options'
import type { GrowthState } from '@/lib/growth'
import { mailStatus } from './outbox-views'


/**
 * Where each project stands on organic growth, for the "what now?" lists: the marketing hub shows one
 * project, Vandaag all of them. A handful of queries for the whole portfolio.
 */
export async function growthStates(db: Db, ownerId: string, now = new Date()): Promise<Map<string, GrowthState>> {
  const [briefs, items, contacts, firstMails, mail] = await Promise.all([
    db.select({ projectId: s.brief.projectId, kind: s.brief.kind }).from(s.brief).where(eq(s.brief.ownerId, ownerId)),
    db
      .select({
        id: s.contentItem.id,
        projectId: s.contentItem.projectId,
        kind: s.contentItem.kind,
        status: s.contentItem.status,
        doneAt: s.contentItem.doneAt,
        plannedFor: s.contentItem.plannedFor,
        createdAt: s.contentItem.createdAt,
        contactId: s.contentItem.contactId,
      })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.ownerId, ownerId), inArray(s.contentItem.kind, ['social', 'email', 'article', 'experiment']), ne(s.contentItem.status, 'archived'))),
    db.select({ id: s.contact.id, projectId: s.contact.projectId, email: s.contact.email, status: s.contact.status }).from(s.contact).where(eq(s.contact.ownerId, ownerId)),
    db
      .select({ contentItemId: s.emailJob.contentItemId })
      .from(s.emailJob)
      .where(and(eq(s.emailJob.ownerId, ownerId), eq(s.emailJob.step, 0))),
    mailStatus(db, ownerId, now),
  ])
  const today = dayOf(now)
  const week = weekStart(today)
  const month = monthStart(today)
  const inQueue = new Set(firstMails.map((m) => m.contentItemId).filter(Boolean))
  const contactById = new Map(contacts.map((c) => [c.id, c]))
  const projectIds = new Set([...briefs.map((b) => b.projectId), ...items.map((i) => i.projectId), ...contacts.map((c) => c.projectId)].filter((id): id is string => Boolean(id)))

  const out = new Map<string, GrowthState>()
  for (const projectId of projectIds) {
    const kinds = new Set(briefs.filter((b) => b.projectId === projectId).map((b) => b.kind))
    const own = items.filter((i) => i.projectId === projectId)
    const ownContacts = contacts.filter((c) => c.projectId === projectId)
    const posts = own.filter((i) => i.kind === 'social')
    const experiments = own.filter((i) => i.kind === 'experiment')
    out.set(projectId, {
      hasProfile: kinds.has('profile'),
      hasPlan: kinds.has('plan'),
      hasLinkedin: kinds.has('linkedin'),
      hasKeywords: kinds.has('seo'),
      experimentsRunning: experiments.filter((e) => e.status === 'planned').length,
      experimentsBacklog: experiments.filter((e) => e.status === 'draft').length,
      articlesThisMonth: own.filter((i) => i.kind === 'article' && dayOf(i.createdAt) >= month).length,
      newContactsWithEmail: ownContacts.filter((c) => c.status === 'new' && c.email).length,
      readyDrafts: own.filter((e) => {
        if (e.kind !== 'email' || e.status !== 'draft' || !e.contactId || inQueue.has(e.id)) return false
        const contact = contactById.get(e.contactId)
        return Boolean(contact?.email) && !isStopped(contact?.status)
      }).length,
      postsDoneThisWeek: posts.filter((p) => p.status === 'done' && p.doneAt && dayOf(p.doneAt) >= week).length,
      postsPlannedThisWeek: posts.filter((p) => p.status !== 'done' && p.plannedFor && p.plannedFor >= today && p.plannedFor <= addDays(week, 6)).length,
      mailReady: mail.ready && mail.enabled,
      contacts: ownContacts.length,
    })
  }
  return out
}

/** A project without any marketing yet: every "what now?" starts from here. */
export const EMPTY_GROWTH: GrowthState = {
  hasProfile: false,
  hasPlan: false,
  hasLinkedin: false,
  hasKeywords: false,
  experimentsRunning: 0,
  experimentsBacklog: 0,
  articlesThisMonth: 0,
  newContactsWithEmail: 0,
  readyDrafts: 0,
  postsDoneThisWeek: 0,
  postsPlannedThisWeek: 0,
  mailReady: false,
  contacts: 0,
}
