import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ClaudeButton } from '@/components/ClaudeButton'
import { ContactForm } from '@/components/ContactForm'
import { ContactImport } from '@/components/ContactImport'
import { ContactStatus } from '@/components/ContactStatus'
import { DealFields } from '@/components/DealFields'
import { EmailDraftCard } from '@/components/EmailDraftCard'
import { MailBanner } from '@/components/Outbox'
import { ProjectHeader } from '@/components/ProjectHeader'
import { ProspectList, ProspectPanel, type ProspectView, WantsInfo, WriteAllMailsButton } from '@/components/Prospects'
import { ScheduleAllButton } from '@/components/ScheduleButton'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { dayLabel, dayOf } from '@/lib/dates'
import { ANSWERED_STATUSES, CONTACT_BASIS_LABELS, isStopped, PROSPECT_STATUSES } from '@/lib/options'
import { byProspectRank } from '@/lib/prospect'
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
  const all = await db.select().from(s.contact).where(eq(s.contact.projectId, id)).orderBy(desc(s.contact.createdAt))
  const today = dayOf(new Date())
  // Proposals from Claude wait for his yes or no on top; the ones he said no to stay out of sight.
  // The one he can reach today with the best fit first (see prospectRank); of equal rank, the one waiting longest.
  const prospects = all
    .filter((c) => c.status === 'prospect')
    .map((c) => ({ ...c, hasPhone: Boolean(c.phone) }))
    .sort(byProspectRank)
    // The ones that wait for a later day go to the end.
    .sort((a, b) => Number(Boolean(a.nextStepOn && a.nextStepOn > today)) - Number(Boolean(b.nextStepOn && b.nextStepOn > today)))
  const skippedCount = all.filter((c) => c.status === 'skipped').length
  const contacts = all.filter((c) => !PROSPECT_STATUSES.includes(c.status))
  const [projectRow] = await db.select({ perDay: s.project.prospectPerDay, what: s.project.what, redLines: s.project.redLines }).from(s.project).where(eq(s.project.id, id))
  const marketingOff = /marketing staat uit/i.test(`${projectRow?.what ?? ''} ${projectRow?.redLines ?? ''}`)
  const drafts = all.length
    ? await db
        .select()
        .from(s.contentItem)
        .where(
          and(
            inArray(
              s.contentItem.contactId,
              all.map((c) => c.id),
            ),
            ne(s.contentItem.status, 'archived'),
          ),
        )
        .orderBy(desc(s.contentItem.createdAt))
    : []
  const [blocked, status, rows] = await Promise.all([claudeBlocked(), mailStatus(db, owner.userId), outboxRows(db, owner.userId, id)])
  const queue = queueByItem(rows)
  const language = ctx.project.languages[0] ?? 'nl'
  const stopped = isStopped
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
      <ProspectPanel projectId={id} projectName={ctx.project.name} perDay={projectRow?.perDay ?? 0} waiting={prospects.length} off={marketingOff} />
      <ProspectList
        items={prospects.map((c): ProspectView => {
          const first = drafts.find((d) => d.contactId === c.id && d.status === 'draft')
          const body = first?.body as { subject?: string; body?: string; followups?: unknown[] } | undefined
          return {
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
            waitUntil: c.nextStepOn && c.nextStepOn > today ? { day: c.nextStepOn, label: dayLabel(c.nextStepOn), why: c.nextStep } : null,
          }
        })}
      />
      {contacts.length ? (
        <section className="card stack-s">
          <h2>Outreach in één keer</h2>
          <p className="small muted">
            Laat Claude voor elk nieuw contact een persoonlijke mail met twee opvolgmails schrijven, lees ze, en keur ze in één keer goed. Daarna gaan
            ze vanzelf de deur uit, binnen je daglimiet.
          </p>
          <div className="row">
            <WriteAllMailsButton projectId={id} count={newWithEmail} disabledReason={blocked} />
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
                {c.phone ? (
                  <a className="small" href={`tel:${c.phone}`}>
                    Bel {c.phone}
                  </a>
                ) : null}
                {c.basis === 'business' && !isStopped(c.status) ? <WantsInfo contactId={c.id} hasEmail={Boolean(c.email)} /> : null}
                {ANSWERED_STATUSES.includes(c.status) ? <DealFields contactId={c.id} value={c.dealValue} period={c.dealPeriod} nextStep={c.nextStep} nextStepOn={c.nextStepOn} today={today} /> : null}
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
        <p className="empty">Nog geen contacten. Laat Claude hierboven bedrijven zoeken, of voeg ze zelf toe.</p>
      )}
      {skippedCount ? <p className="tiny muted">{skippedCount === 1 ? '1 bedrijf' : `${skippedCount} bedrijven`} overgeslagen: die stelt Claude niet meer voor.</p> : null}
      <section className="card stack-m">
        <h2>Contact toevoegen</h2>
        <ContactForm projectId={id} />
        <ContactImport projectId={id} />
      </section>
    </div>
  )
}
