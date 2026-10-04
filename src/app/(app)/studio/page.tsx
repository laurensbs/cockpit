import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
import Link from 'next/link'
import { EmailDraftCard } from '@/components/EmailDraftCard'
import { IdeaCard, OpportunityCard } from '@/components/IdeaCard'
import { IdeaMatrix } from '@/components/IdeaMatrix'
import { PostCard } from '@/components/PostCard'
import { StudioGenerator } from '@/components/StudioGenerator'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayLabel, dayOf } from '@/lib/dates'
import { ACTIVE_STAGES, isStage } from '@/lib/options'
import { claudeBlocked } from '@/server/claude-status'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Studio' }

const TABS = [
  { key: 'drafts', label: 'Concepten' },
  { key: 'calendar', label: 'Kalender' },
  { key: 'ideas', label: 'Idee-lab' },
  { key: 'opportunities', label: 'Kansen' },
] as const
type Tab = (typeof TABS)[number]['key']

type Row = typeof s.contentItem.$inferSelect & { projectName: string | null }
const b = (row: Row) => row.body as Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : 3)

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ tab?: string; project?: string; archived?: string }> }) {
  const owner = await requireOwner('/studio')
  const params = await searchParams
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : 'drafts'
  const showArchived = params.archived === '1'
  const db = await getDb()
  const projects = (
    await db
      .select({ id: s.project.id, name: s.project.name, stage: s.project.stage, languages: s.project.languages })
      .from(s.project)
      .where(eq(s.project.ownerId, owner.userId))
      .orderBy(asc(s.project.sortOrder), asc(s.project.name))
  ).filter((p) => isStage(p.stage) && ACTIVE_STAGES.includes(p.stage))
  const current = projects.find((p) => p.id === params.project) ?? projects[0]
  const href = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    const next = { tab, project: current?.id, ...over }
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v)
    return `/studio?${q.toString()}`
  }

  if (!current) {
    return (
      <div className="stack-l">
        <h1>Studio</h1>
        <p className="empty">
          Eerst een actief project. <Link href="/projects">Naar projecten</Link>
        </p>
      </div>
    )
  }

  const kinds = tab === 'drafts' || tab === 'calendar' ? ['email', 'social'] : tab === 'ideas' ? ['idea'] : ['opportunity']
  const rows: Row[] = await db
    .select({ item: s.contentItem, projectName: s.project.name })
    .from(s.contentItem)
    .leftJoin(s.project, eq(s.project.id, s.contentItem.projectId))
    .where(
      and(
        eq(s.contentItem.ownerId, owner.userId),
        eq(s.contentItem.projectId, current.id),
        inArray(s.contentItem.kind, kinds),
        showArchived ? eq(s.contentItem.status, 'archived') : ne(s.contentItem.status, 'archived'),
      ),
    )
    .orderBy(desc(s.contentItem.createdAt))
    .limit(120)
    .then((r) => r.map(({ item, projectName }) => ({ ...item, projectName })))

  const contactEmails = new Map(
    (
      await db
        .select({ id: s.contact.id, email: s.contact.email })
        .from(s.contact)
        .where(eq(s.contact.projectId, current.id))
    ).map((c) => [c.id, c.email]),
  )
  const blocked = await claudeBlocked()
  const generatorFor = (kind: 'emails' | 'posts' | 'ideas' | 'opportunities') => (
    <StudioGenerator key={`${kind}-${current.id}`} kind={kind} projectId={current.id} languages={current.languages} disabledReason={blocked} />
  )

  const emails = rows.filter((r) => r.kind === 'email')
  const posts = rows.filter((r) => r.kind === 'social')
  const ideas = rows.filter((r) => r.kind === 'idea')
  const opportunities = rows.filter((r) => r.kind === 'opportunity')
  const today = dayOf(new Date())

  const emailCard = (r: Row) => (
    <EmailDraftCard
      key={r.id}
      email={{ id: r.id, title: r.title, subject: str(b(r).subject), body: str(b(r).body), ps: str(b(r).ps), to: r.contactId ? (contactEmails.get(r.contactId) ?? null) : null, status: r.status, rating: r.rating, projectName: null }}
    />
  )
  const postCard = (r: Row) => (
    <PostCard
      key={r.id}
      post={{
        id: r.id,
        title: r.title,
        platform: r.channel,
        format: str(b(r).format),
        hook: str(b(r).hook),
        caption: str(b(r).caption),
        hashtags: Array.isArray(b(r).hashtags) ? (b(r).hashtags as unknown[]).map(String) : [],
        visualBrief: str(b(r).visualBrief),
        bestTime: str(b(r).bestTime),
        status: r.status,
        plannedFor: r.plannedFor,
        rating: r.rating,
        projectName: null,
      }}
    />
  )

  return (
    <div className="stack-l">
      <header className="stack-s">
        <h1>Studio</h1>
        <p className="lede">Concepten van Claude voor {current.name}. Niets gaat vanzelf de deur uit: jij kopieert, plant en verstuurt.</p>
      </header>
      <nav className="row" aria-label="Project">
        {projects.map((p) => (
          <Link key={p.id} href={href({ project: p.id })} className={`chip${p.id === current.id ? ' accent' : ''}`} aria-current={p.id === current.id ? 'page' : undefined}>
            {p.name}
          </Link>
        ))}
      </nav>
      <nav className="segmented" aria-label="Onderdeel" style={{ overflowX: 'auto', maxWidth: '100%' }}>
        {TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key })} aria-current={t.key === tab ? 'page' : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'drafts' ? (
        <>
          <div className="grid">
            {generatorFor('emails')}
            {generatorFor('posts')}
          </div>
          {emails.length || posts.length ? (
            <div className="grid">
              {emails.map(emailCard)}
              {posts.map(postCard)}
            </div>
          ) : (
            <p className="empty">Nog geen concepten voor {current.name}.</p>
          )}
        </>
      ) : null}

      {tab === 'calendar' ? (
        <section className="card stack-s">
          <h2>Komende twee weken</h2>
          <div className="calendar">
            {Array.from({ length: 14 }, (_, i) => addDays(today, i)).map((day) => {
              const planned = rows.filter((r) => r.plannedFor === day)
              return (
                <div key={day} className={`day${day === today ? ' today' : ''}`}>
                  <span className="day-label small">{day === today ? 'vandaag' : dayLabel(day)}</span>
                  <div className="stack-s">{planned.length ? planned.map((r) => (r.kind === 'social' ? postCard(r) : emailCard(r))) : <span className="tiny faint">—</span>}</div>
                </div>
              )
            })}
          </div>
          <p className="tiny muted">Plan een post vanaf zijn kaart in Concepten (veld “Plan”).</p>
        </section>
      ) : null}

      {tab === 'ideas' ? (
        <>
          {generatorFor('ideas')}
          {ideas.length ? (
            <>
              <section className="card stack-s" style={{ alignItems: 'center' }}>
                <h2>Waar begin je?</h2>
                <IdeaMatrix ideas={ideas.map((r) => ({ impact: num(b(r).impact), effort: num(b(r).effort) }))} />
              </section>
              <div className="grid">
                {ideas.map((r, i) => (
                  <IdeaCard
                    key={r.id}
                    index={i}
                    idea={{
                      id: r.id,
                      title: r.title,
                      category: str(b(r).category),
                      why: str(b(r).why),
                      firstStep: str(b(r).firstStep),
                      impact: num(b(r).impact),
                      effort: num(b(r).effort),
                      cost: str(b(r).cost),
                      wildness: num(b(r).wildness),
                      status: r.status,
                      rating: r.rating,
                      projectName: null,
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="empty">Nog geen ideeën. Kies een manier van denken en laat Claude er zes bedenken.</p>
          )}
        </>
      ) : null}

      {tab === 'opportunities' ? (
        <>
          {generatorFor('opportunities')}
          {opportunities.length ? (
            <div className="grid">
              {opportunities.map((r) => (
                <OpportunityCard
                  key={r.id}
                  item={{ id: r.id, title: r.title, type: str(b(r).type), url: typeof b(r).url === 'string' ? (b(r).url as string) : null, why: str(b(r).why), howToApproach: str(b(r).howToApproach), status: r.status, rating: r.rating, projectName: null }}
                />
              ))}
            </div>
          ) : (
            <p className="empty">Nog geen kansen gezocht voor {current.name}.</p>
          )}
        </>
      ) : null}

      <Link href={href({ archived: showArchived ? undefined : '1' })} className="tiny muted" style={{ alignSelf: 'start' }}>
        {showArchived ? '← Terug naar de concepten' : 'Gearchiveerd bekijken'}
      </Link>
    </div>
  )
}
