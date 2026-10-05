import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm'
import { FlaskConical, Mail, Megaphone, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { ArticleCard } from '@/components/ArticleCard'
import { EmailDraftCard } from '@/components/EmailDraftCard'
import { ExperimentCard, type ExperimentView } from '@/components/ExperimentCard'
import { Icon } from '@/components/Icon'
import { IdeaCard, OpportunityCard } from '@/components/IdeaCard'
import { IdeaMatrix } from '@/components/IdeaMatrix'
import { MailBanner, OutboxList } from '@/components/Outbox'
import { PostCard } from '@/components/PostCard'
import { StudioGenerator } from '@/components/StudioGenerator'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayLabel, dayOf, weekStart } from '@/lib/dates'
import { daysLeft, experimentActual, experimentVerdict } from '@/lib/experiments'
import { isMetricKey, METRIC_DEFS } from '@/lib/metrics'
import { actionHref, nextActions, type HubTab } from '@/lib/growth'
import { ACTIVE_STAGES, ANSWERED_STATUSES, isStage, isStopped } from '@/lib/options'
import { claudeBlocked } from '@/server/claude-status'
import { EMPTY_GROWTH, growthStates } from '@/server/growth-state'
import { mailStatus, outboxRows, queueByItem } from '@/server/outbox-views'
import { dailySeries, loadPoints } from '@/server/points'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Marketing' }

const TABS = [
  { key: 'hub', label: 'Overzicht' },
  { key: 'drafts', label: 'Concepten' },
  { key: 'mails', label: 'Mails' },
  { key: 'articles', label: 'Artikelen' },
  { key: 'experiments', label: 'Experimenten' },
  { key: 'calendar', label: 'Kalender' },
  { key: 'ideas', label: 'Idee-lab' },
  { key: 'opportunities', label: 'Kansen' },
] as const
type Tab = (typeof TABS)[number]['key']

const KINDS: Record<Tab, string[]> = {
  hub: ['social', 'email', 'article', 'experiment'],
  drafts: ['email', 'social'],
  mails: ['email'],
  articles: ['article'],
  experiments: ['experiment'],
  calendar: ['email', 'social'],
  ideas: ['idea'],
  opportunities: ['opportunity'],
}

type Row = typeof s.contentItem.$inferSelect & { projectName: string | null }
const b = (row: Row) => row.body as Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : 3)
const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ tab?: string; project?: string; archived?: string }> }) {
  const owner = await requireOwner('/studio')
  const params = await searchParams
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : 'hub'
  const showArchived = params.archived === '1'
  const db = await getDb()
  const projects = (
    await db
      .select({ id: s.project.id, name: s.project.name, stage: s.project.stage, languages: s.project.languages, what: s.project.what, redLines: s.project.redLines, prospectPerDay: s.project.prospectPerDay })
      .from(s.project)
      .where(eq(s.project.ownerId, owner.userId))
      .orderBy(asc(s.project.sortOrder), asc(s.project.name))
  )
    .filter((p) => isStage(p.stage) && ACTIVE_STAGES.includes(p.stage))
    // Projects that do marketing first; one with marketing off (a private project) goes last.
    .map((p) => ({ ...p, off: /marketing staat uit/i.test(`${p.what} ${p.redLines}`) }))
    .sort((a, b) => Number(a.off) - Number(b.off))
  // Without a choice: the project he is actively selling (it looks for businesses every day), else the first that markets.
  const current = projects.find((p) => p.id === params.project) ?? projects.find((p) => !p.off && p.prospectPerDay > 0) ?? projects[0]
  const href = (over: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    const next = { tab, project: current?.id, ...over }
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v)
    return `/studio?${q.toString()}`
  }

  if (!current) {
    return (
      <div className="stack-l">
        <h1>Marketing</h1>
        <p className="empty">
          Eerst een actief project. <Link href="/projects">Naar projecten</Link>
        </p>
      </div>
    )
  }

  const rows: Row[] = await db
    .select({ item: s.contentItem, projectName: s.project.name })
    .from(s.contentItem)
    .leftJoin(s.project, eq(s.project.id, s.contentItem.projectId))
    .where(
      and(
        eq(s.contentItem.ownerId, owner.userId),
        eq(s.contentItem.projectId, current.id),
        inArray(s.contentItem.kind, KINDS[tab]),
        showArchived ? eq(s.contentItem.status, 'archived') : ne(s.contentItem.status, 'archived'),
      ),
    )
    .orderBy(desc(s.contentItem.createdAt))
    .limit(200)
    .then((r) => r.map(({ item, projectName }) => ({ ...item, projectName })))

  const contacts = await db.select({ id: s.contact.id, email: s.contact.email, status: s.contact.status }).from(s.contact).where(eq(s.contact.projectId, current.id))
  const contactEmails = new Map(contacts.map((c) => [c.id, c.email]))
  const [blocked, status, outbox] = await Promise.all([claudeBlocked(), mailStatus(db, owner.userId), outboxRows(db, owner.userId, current.id)])
  const queue = queueByItem(outbox)
  const generatorFor = (kind: 'emails' | 'posts' | 'ideas' | 'opportunities' | 'seo' | 'experiments') => (
    <StudioGenerator key={`${kind}-${current.id}`} kind={kind} projectId={current.id} languages={current.languages} disabledReason={blocked} />
  )

  const emails = rows.filter((r) => r.kind === 'email')
  const posts = rows.filter((r) => r.kind === 'social')
  const ideas = rows.filter((r) => r.kind === 'idea')
  const opportunities = rows.filter((r) => r.kind === 'opportunity')
  const articles = rows.filter((r) => r.kind === 'article')
  const experiments = rows.filter((r) => r.kind === 'experiment')
  const now = new Date()
  const today = dayOf(now)
  const week = weekStart(today)

  const stopped = isStopped
  const emailCard = (r: Row) => {
    const contact = contacts.find((c) => c.id === r.contactId)
    return (
      <EmailDraftCard
        key={r.id}
        email={{
          id: r.id,
          title: r.title,
          subject: str(b(r).subject),
          body: str(b(r).body),
          ps: str(b(r).ps),
          to: r.contactId ? (contactEmails.get(r.contactId) ?? null) : null,
          status: r.status,
          rating: r.rating,
          projectName: null,
          followups: (Array.isArray(b(r).followups) ? (b(r).followups as { subject?: string; body?: string }[]) : []).map((f) => ({ subject: f.subject ?? '', body: f.body ?? '' })),
          queue: queue.get(r.id) ?? null,
          canSchedule: Boolean(contact?.email) && !stopped(contact?.status) && r.status !== 'done',
        }}
      />
    )
  }
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
        hashtags: strs(b(r).hashtags),
        visualBrief: str(b(r).visualBrief),
        bestTime: str(b(r).bestTime),
        status: r.status,
        plannedFor: r.plannedFor,
        rating: r.rating,
        projectName: null,
      }}
    />
  )
  // Running experiments tied to a metric: where it stood at the start, and where it is now.
  const measuredKeys = [...new Set(rows.filter((r) => r.kind === 'experiment' && typeof b(r).metricKey === 'string').map((r) => String(b(r).metricKey)))]
  const measuredRows = measuredKeys.length ? await loadPoints(db, owner.userId, addDays(today, -120), { projectIds: [current.id], keys: measuredKeys }) : []
  const measure = (r: Row) => {
    const key = str(b(r).metricKey)
    if (!isMetricKey(key)) return null
    const startedOn = str(b(r).startedOn)
    const endsOn = str(b(r).endsOn)
    const baseline = typeof b(r).baseline === 'number' ? (b(r).baseline as number) : null
    const targetValue = typeof b(r).targetValue === 'number' ? (b(r).targetValue as number) : null
    const actual =
      typeof b(r).actual === 'number'
        ? (b(r).actual as number)
        : startedOn && endsOn
          ? experimentActual(METRIC_DEFS[key], dailySeries(measuredRows, current.id, key), startedOn, endsOn, today)
          : null
    return { key, label: METRIC_DEFS[key].label, targetValue, startedOn: startedOn || null, endsOn: endsOn || null, baseline, actual, daysLeft: endsOn ? daysLeft(endsOn, today) : null, ...experimentVerdict({ baseline, actual, targetValue }) }
  }
  const experimentView = (r: Row): ExperimentView => ({
    id: r.id,
    title: r.title,
    hypothesis: str(b(r).hypothesis),
    channel: str(b(r).channel),
    steps: strs(b(r).steps),
    metric: str(b(r).metric),
    target: str(b(r).target),
    ice: num(b(r).ice),
    impact: num(b(r).impact),
    confidence: num(b(r).confidence),
    ease: num(b(r).ease),
    cost: str(b(r).cost),
    status: r.status,
    result: str(b(r).result),
    learning: str(b(r).learning),
    measured: measure(r),
  })

  // ---------- the overview ----------
  let hub: React.ReactNode = null
  if (tab === 'hub') {
    const sentThisWeek = outbox.filter((o) => o.status === 'sent' && o.sentAt && dayOf(o.sentAt) >= week).length + emails.filter((e) => e.status === 'done' && e.doneAt && dayOf(e.doneAt) >= week && !queue.get(e.id)).length
    const postsDone = posts.filter((p) => p.status === 'done' && p.doneAt && dayOf(p.doneAt) >= week).length
    const postsPlanned = posts.filter((p) => p.status !== 'done' && p.plannedFor && p.plannedFor >= today && p.plannedFor <= addDays(week, 6)).length
    const running = experiments.filter((e) => e.status === 'planned')
    const actions = nextActions((await growthStates(db, owner.userId, now)).get(current.id) ?? EMPTY_GROWTH)
    const target = (t: HubTab) => (t === 'brain' || t === 'contacts' || t === 'settings' ? actionHref(current.id, t) : href({ tab: t }))
    hub = (
      <>
        <section className="kpis">
          <Link href={href({ tab: 'drafts' })} className="kpi card tile tone-orange">
            <span className="tile-ico" aria-hidden="true">
              <Megaphone size={22} strokeWidth={2.5} />
            </span>
            <span className="eyebrow">Posts deze week</span>
            <span className="value">{postsDone}</span>
            <span className="tiny muted">{postsPlanned} gepland</span>
          </Link>
          <Link href={href({ tab: 'mails' })} className="kpi card tile tone-blue">
            <span className="tile-ico" aria-hidden="true">
              <Mail size={22} strokeWidth={2.5} />
            </span>
            <span className="eyebrow">Mails deze week</span>
            <span className="value">{sentThisWeek}</span>
            <span className="tiny muted">{outbox.filter((o) => o.status === 'queued').length} in de wachtrij</span>
          </Link>
          <Link href={`/projects/${current.id}/contacts`} className="kpi card tile tone-green">
            <span className="tile-ico" aria-hidden="true">
              <MessageCircle size={22} strokeWidth={2.5} />
            </span>
            <span className="eyebrow">Antwoorden</span>
            <span className="value">{contacts.filter((c) => ANSWERED_STATUSES.includes(c.status)).length}</span>
            <span className="tiny muted">van {contacts.length} contacten</span>
          </Link>
          <Link href={href({ tab: 'experiments' })} className="kpi card tile tone-violet">
            <span className="tile-ico" aria-hidden="true">
              <FlaskConical size={22} strokeWidth={2.5} />
            </span>
            <span className="eyebrow">Experimenten</span>
            <span className="value">{running.length}</span>
            <span className="tiny muted">{experiments.filter((e) => e.status === 'done' && str(b(e).result) === 'won').length} gewonnen</span>
          </Link>
        </section>
        <section className="card stack-s">
          <h2>Organische groei: wat nu?</h2>
          {actions.length ? (
            <ol className="list next-steps">
              {actions.map((a) => (
                <li key={a.key} className="row between">
                  <span className="stack-xs grow" style={{ minWidth: 0 }}>
                    <strong>{a.title}</strong>
                    <span className="tiny muted">{a.why}</span>
                  </span>
                  <Link href={target(a.tab)} className="button secondary small">
                    Doen <Icon name="arrow" size={14} />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="small">Alles loopt: posts staan gepland, een experiment draait en je outreach is bij. Tijd om te meten.</p>
          )}
        </section>
        {running.length ? (
          <section className="stack-s">
            <h2>Loopt nu</h2>
            <div className="grid">
              {running.map((r) => (
                <ExperimentCard key={r.id} experiment={experimentView(r)} />
              ))}
            </div>
          </section>
        ) : null}
        <section className="card stack-s">
          <div className="row between">
            <h2>Mails</h2>
            <Link href={href({ tab: 'mails' })} className="button ghost small">
              Alles <Icon name="arrow" size={14} />
            </Link>
          </div>
          <MailBanner status={status} />
          <OutboxList rows={outbox.slice(0, 5)} now={now} />
        </section>
      </>
    )
  }

  return (
    <div className="stack-l">
      <header className="stack-s">
        <h1>Marketing</h1>
        <p className="lede">Alles voor de groei van {current.name}, met Claude Code als partner. Jij keurt goed; niets gaat zonder jou de deur uit.</p>
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

      {hub}

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

      {tab === 'mails' ? (
        <>
          <MailBanner status={status} />
          <section className="card stack-s">
            <div className="row between">
              <h2>Wachtrij en verzonden</h2>
              <Link href={`/projects/${current.id}/contacts`} className="button secondary small">
                Naar contacten
              </Link>
            </div>
            <OutboxList rows={outbox} now={now} />
          </section>
        </>
      ) : null}

      {tab === 'articles' ? (
        <>
          {generatorFor('seo')}
          {articles.length ? (
            <div className="grid">
              {articles.map((r) => (
                <ArticleCard
                  key={r.id}
                  article={{ id: r.id, title: r.title, slug: str(b(r).slug), metaDescription: str(b(r).metaDescription), keywords: strs(b(r).keywords), outline: strs(b(r).outline), markdown: str(b(r).markdown), status: r.status, rating: r.rating }}
                />
              ))}
            </div>
          ) : (
            <p className="empty">Nog geen artikelen. Eén goed artikel per maand blijft jarenlang bezoekers brengen.</p>
          )}
        </>
      ) : null}

      {tab === 'experiments' ? (
        <>
          {generatorFor('experiments')}
          <div className="board">
            {(
              [
                ['draft', 'Klaar om te starten'],
                ['planned', 'Loopt'],
                ['done', 'Afgerond'],
              ] as const
            ).map(([st, label]) => {
              const list = experiments.filter((e) => e.status === st).map(experimentView)
              if (st === 'draft') list.sort((x, y) => y.ice - x.ice)
              return (
                <section key={st} className="stack-s" aria-label={label}>
                  <h2 className="row">
                    {label} <span className="chip">{list.length}</span>
                  </h2>
                  {list.length ? list.map((e) => <ExperimentCard key={e.id} experiment={e} />) : <p className="tiny faint">—</p>}
                </section>
              )
            })}
          </div>
        </>
      ) : null}

      {tab === 'calendar' ? (
        <section className="card stack-s">
          <h2>Komende twee weken</h2>
          {rows.some((r) => r.plannedFor && r.plannedFor >= today && r.plannedFor <= addDays(today, 13)) ? (
            <div className="calendar">
              {Array.from({ length: 14 }, (_, i) => addDays(today, i)).map((day) => {
                const planned = rows.filter((r) => r.plannedFor === day)
                return (
                  <div key={day} className={`day${day === today ? ' today' : ''}${planned.length ? '' : ' empty-day'}`}>
                    <span className="day-label small">{day === today ? 'vandaag' : dayLabel(day)}</span>
                    <div className="stack-s">{planned.length ? planned.map((r) => (r.kind === 'social' ? postCard(r) : emailCard(r))) : <span className="tiny faint">—</span>}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="empty">Nog niets gepland voor de komende twee weken.</p>
          )}
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

      {tab !== 'hub' && tab !== 'mails' ? (
        <Link href={href({ archived: showArchived ? undefined : '1' })} className="tiny muted" style={{ alignSelf: 'start' }}>
          {showArchived ? '← Terug naar de concepten' : 'Gearchiveerd bekijken'}
        </Link>
      ) : null}
    </div>
  )
}
