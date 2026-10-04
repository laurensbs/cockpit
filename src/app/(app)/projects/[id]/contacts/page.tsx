import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ClaudeButton } from '@/components/ClaudeButton'
import { ContactForm } from '@/components/ContactForm'
import { ContactStatus } from '@/components/ContactStatus'
import { EmailDraftCard } from '@/components/EmailDraftCard'
import { MailBanner } from '@/components/Outbox'
import { ProjectHeader } from '@/components/ProjectHeader'
import { ScheduleAllButton } from '@/components/ScheduleButton'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { CONTACT_BASIS_LABELS } from '@/lib/options'
import { hostOf } from '@/lib/urls'
import { loadJobContext } from '@/server/ai/context'
import { claudeBlocked } from '@/server/claude-status'
import { mailStatus, outboxRows, queueByItem } from '@/server/outbox-views'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Contacten' }

export default async function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await requireOwner(`/projects/${id}/contacts`)
  const db = await getDb()
  const ctx = await loadJobContext(db, owner.userId, id)
  if (!ctx) notFound()
  const contacts = await db.select().from(s.contact).where(eq(s.contact.projectId, id)).orderBy(desc(s.contact.createdAt))
  const drafts = contacts.length
    ? await db
        .select()
        .from(s.contentItem)
        .where(
          and(
            inArray(
              s.contentItem.contactId,
              contacts.map((c) => c.id),
            ),
            ne(s.contentItem.status, 'archived'),
          ),
        )
        .orderBy(desc(s.contentItem.createdAt))
    : []
  const [blocked, status, rows] = await Promise.all([claudeBlocked(), mailStatus(db, owner.userId), outboxRows(db, owner.userId, id)])
  const queue = queueByItem(rows)
  const language = ctx.project.languages[0] ?? 'nl'
  const stopped = (status: string) => status === 'replied' || status === 'no'
  const ready = drafts.filter((d) => {
    const c = contacts.find((x) => x.id === d.contactId)
    return d.status === 'draft' && c?.email && !stopped(c.status) && !queue.get(d.id)
  })
  const readyCount = new Set(ready.map((d) => d.contactId)).size
  const newWithEmail = contacts.filter((c) => c.status === 'new' && c.email).length

  return (
    <div className="stack-l">
      <ProjectHeader project={ctx.project} active="contacts" />
      <p className="notice small">
        Alleen organisaties, zakelijke adressen of mensen met wie je al contact hebt. Elke mail krijgt een afmeldregel, en wie nee zegt, zet je op
        “Geen interesse”. Geen gekochte lijsten. Claude ziet de naam en je notities, nooit het e-mailadres.
      </p>
      <MailBanner status={status} />
      {contacts.length ? (
        <section className="card stack-s">
          <h2>Outreach in één keer</h2>
          <p className="small muted">
            Laat Claude voor elk nieuw contact een persoonlijke mail met twee opvolgmails schrijven, lees ze, en keur ze in één keer goed. Daarna gaan
            ze vanzelf de deur uit, binnen je daglimiet.
          </p>
          <div className="row">
            <ClaudeButton task="contact_mails" projectId={id} label={`Schrijf mails voor ${newWithEmail} nieuw${newWithEmail === 1 ? ' contact' : 'e contacten'}`} disabledReason={newWithEmail ? blocked : 'Geen nieuwe contacten met een e-mailadres.'} options={{ language }} variant="secondary" />
            <ScheduleAllButton projectId={id} count={readyCount} />
          </div>
        </section>
      ) : null}
      {contacts.length ? (
        <ul className="stack-m" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {contacts.map((c) => {
            const mine = drafts.filter((d) => d.contactId === c.id)
            return (
              <li key={c.id} className="card stack-s">
                <div className="row between">
                  <div className="stack-xs">
                    <strong>{c.organization}</strong>
                    <span className="tiny muted">
                      {[c.name, c.email, c.website ? hostOf(c.website) : null].filter(Boolean).join(' · ') || 'Nog geen adres'}
                    </span>
                    <span className="tiny faint">{CONTACT_BASIS_LABELS[c.basis] ?? c.basis}</span>
                  </div>
                  <ContactStatus contactId={c.id} status={c.status} />
                </div>
                {c.note ? <p className="small muted">{c.note}</p> : null}
                <ClaudeButton task="contact_mail" projectId={id} label={mine.length ? 'Schrijf een nieuwe mail' : 'Schrijf een persoonlijke mail'} disabledReason={blocked} options={{ contactId: c.id, language }} variant="secondary" />
                {mine.map((d) => {
                  const body = d.body as { subject?: string; body?: string; ps?: string; followups?: { subject?: string; body?: string }[] }
                  return (
                    <EmailDraftCard
                      key={d.id}
                      email={{
                        id: d.id,
                        title: d.title,
                        subject: body.subject ?? '',
                        body: body.body ?? '',
                        ps: body.ps ?? '',
                        to: c.email,
                        status: d.status,
                        rating: d.rating,
                        projectName: null,
                        followups: (body.followups ?? []).map((f) => ({ subject: f.subject ?? '', body: f.body ?? '' })),
                        queue: queue.get(d.id) ?? null,
                        canSchedule: Boolean(c.email) && !stopped(c.status) && d.status !== 'done',
                      }}
                    />
                  )
                })}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="empty">Nog geen contacten. Voeg ze toe, of laat Claude kansen zoeken in de Studio.</p>
      )}
      <section className="card stack-m">
        <h2>Contact toevoegen</h2>
        <ContactForm projectId={id} />
      </section>
    </div>
  )
}
