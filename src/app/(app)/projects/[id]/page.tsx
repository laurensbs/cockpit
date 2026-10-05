import { and, desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AskClaude } from '@/components/AskClaude'
import { CoachCard } from '@/components/CoachCard'
import { FunnelStrip } from '@/components/FunnelStrip'
import { GrowthCard } from '@/components/GrowthCard'
import { Heatmap } from '@/components/Heatmap'
import { Icon } from '@/components/Icon'
import { MetricForm } from '@/components/MetricForm'
import { NextSteps } from '@/components/NextSteps'
import { ProjectTabs } from '@/components/ProjectTabs'
import { RepoList } from '@/components/RepoList'
import { SetupCard } from '@/components/SetupCard'
import { Socials } from '@/components/Socials'
import { StageSelect } from '@/components/StageSelect'
import { SyncButton } from '@/components/SyncButton'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { activeDays, daysSinceLast, mergeCommitDays } from '@/lib/activity'
import { addMonths, dayOf, monthLabel, monthStart } from '@/lib/dates'
import { ACTION_TASKS, actionHref, nextActions } from '@/lib/growth'
import { LANGUAGE_LABELS, METRIC_KEYS, METRIC_LABELS } from '@/lib/options'
import { nextSetupStep } from '@/lib/setup'
import { ago, formatEuro, formatNumber } from '@/lib/time'
import { socialsOf } from '@/lib/socials'
import { hostOf } from '@/lib/urls'
import { claudeBlocked } from '@/server/claude-status'
import { latestCoach } from '@/server/coach'
import { readCompass } from '@/server/compass'
import { EMPTY_GROWTH, growthStates } from '@/server/growth-state'
import { outcomeHref, outcomeStates } from '@/server/outcome-state'
import { metricsSince } from '@/server/queries'
import { requireOwner } from '@/server/session'
import { loadSetup } from '@/server/setup-check'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await getDb()
  const [p] = await db.select({ name: s.project.name }).from(s.project).where(eq(s.project.id, id))
  return { title: p?.name ?? 'Project' }
}

function Fact({ label, value, empty }: { label: string; value: string; empty: string }) {
  return (
    <div className="stack-xs">
      <p className="eyebrow">{label}</p>
      <p className={`prewrap ${value ? '' : 'faint small'}`}>{value || empty}</p>
    </div>
  )
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await requireOwner(`/projects/${id}`)
  const db = await getDb()
  const [project] = await db
    .select()
    .from(s.project)
    .where(and(eq(s.project.id, id), eq(s.project.ownerId, owner.userId)))
  if (!project) notFound()
  const [company] = project.companyId ? await db.select().from(s.company).where(eq(s.company.id, project.companyId)) : []
  const repos = await db.select().from(s.repo).where(eq(s.repo.projectId, id)).orderBy(desc(s.repo.pushedAt))

  const now = new Date()
  const compass = readCompass(project)
  const setup = /marketing staat uit/i.test(`${project.what} ${project.redLines}`) ? [] : await loadSetup(db, project)
  const coach = setup.length ? await latestCoach(db, owner.userId, project.id) : null
  const today = dayOf(now)
  const thisMonth = monthStart(today)
  const months = [addMonths(thisMonth, -2), addMonths(thisMonth, -1), thisMonth]
  const metrics = (await metricsSince(db, owner.userId, months[0], [id]))[id] ?? {}
  const shownKeys = METRIC_KEYS.filter((k) => months.some((m) => metrics[m]?.[k] != null))
  const commitDays = mergeCommitDays(repos.map((r) => r.commitDays))
  const quiet = daysSinceLast(commitDays, today)
  const commits = repos
    .flatMap((r) => r.recentCommits.map((c) => ({ ...c, repo: r.fullName.split('/')[1] })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
  const intakeDone = Boolean(project.oneLiner && project.what && project.audience && project.goal)
  const [growth, blocked, outcomes] = await Promise.all([growthStates(db, owner.userId, now), claudeBlocked(), outcomeStates(db, owner.userId, now)])
  const outcome = outcomes.get(project.id)
  const item = (href: string, task: string | null, options?: Record<string, unknown>) => ({ projectId: project.id, projectName: project.name, color: company?.color ?? null, href, task, options })
  // The step from the numbers first (the leak, or a model or numbers that are missing), then the usual marketing steps.
  const steps = [
    ...(outcome?.step ? [{ key: outcome.step.key, title: outcome.step.title, why: outcome.step.why, projects: [item(outcomeHref(project.id, outcome.step.place), outcome.step.task, outcome.step.options)] }] : []),
    ...nextActions(growth.get(project.id) ?? EMPTY_GROWTH).map((a) => ({ key: a.key, title: a.title, why: a.why, projects: [item(actionHref(project.id, a.tab), ACTION_TASKS[a.key] ?? null)] })),
  ].slice(0, 3)

  return (
    <div className="stack-l">
      <header className="stack-m">
        <Link href="/projects" className="button ghost small" style={{ alignSelf: 'start' }}>
          ← Projecten
        </Link>
        <section className="card project-hero stack-m">
          <div className="project-hero-top">
            <span className="project-disc" style={{ '--tone': company?.color ?? 'var(--accent)' } as React.CSSProperties} aria-hidden="true">
              {project.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="stack-xs grow">
              {company ? (
                <Link href={`/companies/${company.id}`} className="tiny muted" style={{ textDecoration: 'none' }}>
                  {company.name}
                </Link>
              ) : null}
              <h1>{project.name}</h1>
              <div className="row" style={{ gap: '0.4rem' }}>
                {compass?.phase ? (
                  <span className="chip accent" title={`Uit ${compass.source}${compass.goal ? `: ${compass.goal}` : ''}`}>
                    Fase {compass.phase}
                  </span>
                ) : null}
                {project.siteUrl ? (
                  <a href={project.siteUrl} target="_blank" rel="noreferrer noopener" className={`chip ${project.siteStatus == null ? '' : project.siteStatus > 0 && project.siteStatus < 500 ? 'good' : 'bad'}`} title={project.siteCheckedAt ? `Gecontroleerd ${ago(project.siteCheckedAt, now)}` : undefined}>
                    <Icon name="external" size={14} /> {hostOf(project.siteUrl)}
                    {project.siteStatus == null ? null : project.siteStatus > 0 && project.siteStatus < 500 ? ' · online' : project.siteStatus ? ` · fout ${project.siteStatus}` : ' · niet bereikbaar'}
                  </a>
                ) : null}
              </div>
            </div>
            <div className="row project-actions">
              <StageSelect projectId={project.id} stage={project.stage} />
              <Link href={`/projects/${project.id}/edit`} className="button secondary small">
                <Icon name="edit" size={16} /> Bewerken
              </Link>
            </div>
          </div>
          {project.oneLiner ? <p className="lede">{project.oneLiner}</p> : null}
          <Socials projectId={project.id} linked={socialsOf(project.links)} />
        </section>
        <ProjectTabs projectId={project.id} active="overview" />
      </header>

      {coach ? (
        <CoachCard
          coach={{ advice: coach.advice, projectId: project.id, projectName: project.name, when: ago(coach.at, now), stamp: coach.at.toISOString() }}
          scope={{ projectId: project.id }}
          disabledReason={blocked}
        />
      ) : null}

      {!intakeDone ? (
        <div className="notice row between">
          <span>Vul de vijf vragen in: daar haalt de marketing zijn kennis uit.</span>
          <Link href={`/projects/${project.id}/edit`} className="button primary small">
            Intake invullen
          </Link>
        </div>
      ) : null}

      {outcome?.model && outcome.pace ? <GrowthCard projectId={project.id} model={outcome.model} pace={outcome.pace} spark={outcome.spark} sources={outcome.sources} /> : null}
      {outcome?.model && outcome.funnel ? <FunnelStrip stages={outcome.stages} funnel={outcome.funnel} /> : null}

      <NextSteps groups={steps} disabledReason={blocked} project={project.name} />

      {setup.length ? (
        <SetupCard
          projectId={project.id}
          next={nextSetupStep(setup)?.item.key ?? null}
          steps={setup.map((v) => ({ key: v.item.key, group: v.item.group, title: v.item.title, why: v.item.why, steps: v.item.steps, who: v.item.who, cost: v.item.cost, legal: Boolean(v.item.legal), status: v.status, source: v.source, note: v.note }))}
        />
      ) : null}

      <AskClaude projects={[]} project={{ id: project.id, name: project.name }} disabledReason={blocked} />

      {/* What the project is and does, its code and its numbers: there when he wants it, not in the way. */}
      <details className="more stack-l">
        <summary className="button secondary">Meer over {project.name}</summary>
      <section className="card stack-m">
        <h2>Intake</h2>
        <div className="grid">
          <Fact label="Wat het doet" value={project.what} empty="Nog niet ingevuld" />
          <Fact label="Voor wie" value={project.audience} empty="Nog niet ingevuld" />
          <Fact label="Doel over 90 dagen" value={project.goal} empty="Nog niet ingevuld" />
          <Fact label="North star" value={project.northStar} empty="Nog niet gekozen" />
          <Fact label="Rode lijnen" value={project.redLines} empty="Geen bijzondere" />
          <Fact
            label="Talen en markten"
            value={[project.languages.map((l) => LANGUAGE_LABELS[l as keyof typeof LANGUAGE_LABELS] ?? l).join(', '), project.markets.join(', ')].filter(Boolean).join(' · ')}
            empty="Nog niet gekozen"
          />
        </div>
      </section>

      <section className="card stack-m">
        <div className="row between">
          <h2>Activiteit</h2>
          <span className="chip xp">
            {activeDays(commitDays, today, 30)} actieve dagen in 30
          </span>
        </div>
        {repos.length ? (
          <>
            <Heatmap days={commitDays} today={today} label="Commits per dag, de laatste 13 weken" />
            <p className="tiny muted">{quiet === null ? 'Nog geen commits gezien in 90 dagen.' : quiet === 0 ? 'Vandaag nog gecommit.' : `Laatste commit ${quiet} dag${quiet === 1 ? '' : 'en'} geleden.`}</p>
            {commits.length ? (
              <ul className="list small">
                {commits.map((c, i) => (
                  <li key={`${c.date}-${i}`} className="row between nowrap">
                    <span className="grow" style={{ overflowWrap: 'anywhere' }}>
                      {c.message}
                    </span>
                    <span className="tiny faint" style={{ whiteSpace: 'nowrap' }}>
                      {c.repo} · {ago(new Date(c.date), now)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="muted small">Nog geen repo gekoppeld. Staat het nog niet op GitHub? Dan telt je marketingwerk als activiteit.</p>
        )}
      </section>

      <section className="card stack-m">
        <div className="row between">
          <h2>Repo’s</h2>
          <div className="row">
            {repos.length ? <SyncButton projectId={project.id} /> : null}
            <Link href={`/github?project=${project.id}`} className="button secondary small">
              <Icon name="plus" size={16} /> Koppelen
            </Link>
          </div>
        </div>
        {repos.length ? (
          <RepoList
            repos={repos.map((r) => ({
              id: r.id,
              fullName: r.fullName,
              isPrivate: r.isPrivate,
              archived: r.archived,
              stack: r.stack,
              includeInAi: r.includeInAi,
              syncError: r.syncError,
              syncedLabel: r.syncedAt ? `gelezen ${ago(r.syncedAt, now)}` : 'nog niet gelezen',
            }))}
          />
        ) : (
          <p className="muted small">Geen repo’s.</p>
        )}
      </section>

      <section className="card stack-m">
        <h2>Cijfers</h2>
        {shownKeys.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th />
                  {months.map((m) => (
                    <th key={m} className="num">
                      {monthLabel(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownKeys.map((k) => (
                  <tr key={k}>
                    <th>{METRIC_LABELS[k]}</th>
                    {months.map((m) => {
                      const v = metrics[m]?.[k]
                      return (
                        <td key={m} className="num">
                          {v == null ? '–' : k === 'revenue' || k === 'costs' ? formatEuro(v) : formatNumber(v)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted small">Nog geen cijfers. Omzet, kosten, gebruikers, leads of volgers: één getal per maand is genoeg.</p>
        )}
        <MetricForm projects={[{ id: project.id, name: project.name }]} month={thisMonth.slice(0, 7)} />
      </section>
      </details>
    </div>
  )
}
