import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { ProspectView } from '@/components/Prospects'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { DayStep } from '@/lib/today'
import { daySteps } from './today'

/** One card of the lesson: a day step, or one business out of the "new businesses" step. */
export type LessonCard = Exclude<DayStep, { kind: 'prospects' }> | { kind: 'prospect'; key: string; title: string; sub: string; projectId: string; p: ProspectView }

const PROSPECTS_PER_LESSON = 5

/** The day's three steps, with "new businesses" opened up into one card per business (the best fit first). */
export async function lessonCards(db: Db, ownerId: string): Promise<LessonCard[]> {
  const steps = (await daySteps(db, ownerId)).slice(0, 3)
  const cards: LessonCard[] = []
  for (const step of steps) {
    if (step.kind !== 'prospects') {
      cards.push(step)
      continue
    }
    const rows = await db
      .select()
      .from(s.contact)
      .where(and(eq(s.contact.ownerId, ownerId), eq(s.contact.projectId, step.projectId!), eq(s.contact.status, 'prospect')))
      .orderBy(desc(s.contact.fit), s.contact.createdAt)
      .limit(PROSPECTS_PER_LESSON)
    const drafts = rows.length
      ? await db
          .select({ contactId: s.contentItem.contactId, body: s.contentItem.body })
          .from(s.contentItem)
          .where(and(inArray(s.contentItem.contactId, rows.map((r) => r.id)), eq(s.contentItem.status, 'draft')))
      : []
    for (const c of rows) {
      const body = drafts.find((d) => d.contactId === c.id)?.body as { subject?: string; body?: string; followups?: unknown[] } | undefined
      cards.push({
        kind: 'prospect',
        key: `prospect-${c.id}`,
        title: c.organization,
        sub: [c.city, step.sub].filter(Boolean).join(' · '),
        projectId: c.projectId,
        p: {
          id: c.id,
          organization: c.organization,
          website: c.website,
          city: c.city,
          note: c.note,
          observation: c.observation,
          pitch: c.pitch,
          fit: c.fit,
          channel: c.channel,
          hasPhone: Boolean(c.phone),
          hasEmail: Boolean(c.email),
          draft: body ? { subject: body.subject ?? '', body: body.body ?? '', followups: body.followups?.length ?? 0 } : null,
        },
      })
    }
  }
  return cards
}
