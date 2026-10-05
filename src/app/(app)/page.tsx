import { Flame } from 'lucide-react'
import Link from 'next/link'
import { HealthRing } from '@/components/HealthRing'
import { Icon } from '@/components/Icon'
import { QuestItem } from '@/components/QuestItem'
import { Sparkline } from '@/components/Sparkline'
import { GrowthCard, PaceChip } from '@/components/GrowthCard'
import { NextSteps, SetupChecklist } from '@/components/NextSteps'
import { ClaudeLoggedOut } from '@/components/ClaudeLoggedOut'
import { CoachCard } from '@/components/CoachCard'
import { DayPath } from '@/components/DayPath'
import { WeeklyFocus } from '@/components/WeeklyFocus'
import { WeekScoreCard } from '@/components/WeekScoreCard'
import { getDb } from '@/db'
import { greeting } from '@/lib/dates'
import { ago } from '@/lib/time'
import { dayLine, pickSteps } from '@/lib/today'
import { headlessProblem } from '@/server/claude'
import { latestCoach } from '@/server/coach'
import { claudeBlocked } from '@/server/claude-status'
import { dailyRound, playerStats, projectPulses } from '@/server/game'
import { growthStates } from '@/server/growth-state'
import { outcomeStates } from '@/server/outcome-state'
import { questViews } from '@/server/quest-views'
import { requireOwner } from '@/server/session'
import { setupSteps } from '@/server/setup'
import { dayCandidates, dayProgress, growthStep, orderNextSteps } from '@/server/today'
import { loadWeekScore } from '@/server/week-score'

const TREND = { up: { icon: '▲', label: 'meer dan vorige week', color: 'var(--good)' }, down: { icon: '▼', label: 'minder dan vorige week', color: 'var(--bad)' }, flat: { icon: '●', label: 'gelijk aan vorige week', color: 'var(--faint)' } }

export default async function TodayPage() {
  const owner = await requireOwner()
  const db = await getDb()
  await dailyRound(db, owner.userId)
  const outcomes = await outcomeStates(db, owner.userId)
  const [stats, quests, pulses, growth, blocked] = await Promise.all([
    playerStats(db, owner.userId),
    questViews(db, owner.userId, { status: 'open', limit: 50 }),
    projectPulses(db, owner.userId, new Date(), outcomes),
    growthStates(db, owner.userId),
    claudeBlocked(),
  ])
  const setup = await setupSteps(db, owner.userId, pulses.length)
  const setupLeft = setup.some((step) => !step.done && !step.optional)
  const ordered = orderNextSteps(pulses, outcomes, growth)
  const now = quests.filter((q) => q.bucket === 'overdue' || q.bucket === 'today' || q.kind === 'boss').slice(0, 5)
  const shown = now.length >= 3 ? now : [...now, ...quests.filter((q) => !now.includes(q))].slice(0, 3)
  const { actionStreak } = stats
  // The day route: the first growth step of the least healthy project closes the list.
  const daySteps = pickSteps(await dayCandidates(db, owner.userId, growthStep(ordered)), new Set(), 8)
  const progress = await dayProgress(db, owner.userId)
  const week = await loadWeekScore(db, owner.userId)
  const coach = await latestCoach(db, owner.userId)

  const left = Math.max(0, progress.goal - progress.done)
  // The goal that matters most: the project whose goal is furthest behind (a date and one number).
  const RANK = { overdue: 0, far_behind: 1, behind: 2, no_data: 3, on_track: 4, ahead: 5, done: 6 } as const
  const goalProject = pulses
    .map((p) => ({ id: p.id, o: outcomes.get(p.id) }))
    .filter((x) => x.o?.model && x.o.pace)
    .map((x) => ({ id: x.id, model: x.o!.model!, pace: x.o!.pace!, spark: x.o!.spark, sources: x.o!.sources }))
    .sort((a, b) => RANK[a.pace.status] - RANK[b.pace.status])[0]
  // An empty day: start where the cockpit itself is not ready yet, or with the projects.
  const firstSetup = setup.find((step) => !step.done && !step.optional)
  const empty = firstSetup
    ? { title: `Eerst dit: ${firstSetup.title.charAt(0).toLowerCase()}${firstSetup.title.slice(1)}.`, href: firstSetup.href, label: 'Doe dit eerst' }
    : pulses.length
      ? { title: 'Laat Claude bedrijven zoeken of posts maken; morgen staan je stappen hier.', href: `/projects/${pulses[0].id}/contacts`, label: 'Bedrijven zoeken' }
      : { title: 'Zet je projecten erin, dan maakt Claude je stappen.', href: '/projects', label: 'Projecten toevoegen' }
  const name = owner.name ? owner.name.split(' ')[0] : null

  return (
    <div className="today">
      <header className="today-head stack-xs">
        <h1>{name ? `${greeting(new Date())}, ${name}` : greeting(new Date())}</h1>
        <p className="muted">{left ? (dayLine(daySteps.slice(0, 3)) || 'Claude zet je stappen klaar') : 'Dagdoel gehaald. Meer mag, hoeft niet.'}</p>
      </header>

      {setupLeft ? <SetupChecklist steps={setup} /> : null}

      {headlessProblem() === 'logged-out' ? <ClaudeLoggedOut /> : null}
      <DayPath steps={daySteps} done={progress.done} goal={progress.goal} empty={empty}>
        <CoachCard
          coach={{ advice: coach?.advice ?? null, projectId: coach?.projectId ?? null, projectName: coach?.projectName ?? null, when: coach ? ago(coach.at) : null, stamp: coach ? coach.at.toISOString() : null }}
          scope={null}
          disabledReason={blocked}
          line
        />
      </DayPath>

      <aside className="today-rail" aria-label="Je voortgang">
        {goalProject ? (
          <GrowthCard projectId={goalProject.id} model={goalProject.model} pace={goalProject.pace} spark={goalProject.spark} sources={goalProject.sources} />
        ) : pulses.length ? (
          <section className="card stack-xs">
            <h3>Je doel</h3>
            <p className="small muted">Nog geen doel met een datum. Laat Claude er een voorstellen: één cijfer dat telt, en wat ervoor nodig is.</p>
            <Link href={`/projects/${pulses[0].id}/numbers`} className="button secondary small" style={{ width: 'fit-content' }}>
              Doel kiezen
            </Link>
          </section>
        ) : null}
        <section className="card rail-card">
          <span className="disc tone-orange" style={{ width: 56, height: 56 }} aria-hidden="true">
            <Flame size={28} strokeWidth={2.5} fill={actionStreak.today ? 'currentColor' : 'none'} />
          </span>
          <div className="grow">
            <h3>
              {actionStreak.length} {actionStreak.length === 1 ? 'dag' : 'dagen'} op rij
            </h3>
            <p className="tiny muted">{actionStreak.today ? 'Vandaag al gedaan. Goed bezig.' : 'Doe vandaag één stap om je reeks te houden.'}</p>
          </div>
        </section>
        <WeekScoreCard score={week} projects={pulses.map((p) => ({ id: p.id, name: p.name, color: p.color }))} />
      </aside>

      {/* Everything else stays quiet behind one button: the day route is the page. */}
      <details className="more stack-l">
        <summary className="button secondary">Meer</summary>
        {pulses.length ? <NextSteps groups={ordered.slice(0, 5).map((g) => ({ key: g.key, title: g.title, why: g.why, projects: g.projects }))} disabledReason={blocked} /> : null}

        {pulses.length ? <WeeklyFocus db={db} ownerId={owner.userId} disabledReason={blocked} /> : null}

        <section className="card stack-s">
          <div className="row between">
            <h2>Taken</h2>
            <Link href="/quests" className="button ghost small">
              Alle taken <Icon name="arrow" size={16} />
            </Link>
          </div>
          {shown.length ? (
            <ul className="list" style={{ margin: 0 }}>
              {shown.map((q) => (
                <QuestItem key={q.id} quest={q} />
              ))}
            </ul>
          ) : (
            <p className="empty">
              Geen open taken. <Link href="/quests">Zet er een op</Link>
              {pulses.length ? null : (
                <>
                  {' '}
                  of <Link href="/projects">voeg je projecten toe</Link>
                </>
              )}
              .
            </p>
          )}
        </section>

        {pulses.length ? (
          <section className="card stack-s">
            <h2>Projecten</h2>
            <p className="tiny muted">De minst gezonde bovenaan: daar levert aandacht het meest op.</p>
            <ul className="list">
              {pulses.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="row nowrap pulse">
                    <HealthRing score={p.health.score} />
                    <span className="grow stack-xs" style={{ minWidth: 0 }}>
                      <span className="row nowrap">
                        <span className="dot" style={{ background: p.color }} />
                        <strong style={{ overflowWrap: 'anywhere' }}>{p.name}</strong>
                        <span title={TREND[p.trend].label} style={{ color: TREND[p.trend].color, fontSize: '0.7rem' }}>
                          {TREND[p.trend].icon}
                        </span>
                        {p.pace ? <PaceChip status={p.pace} /> : null}
                      </span>
                      <span className="tiny muted">{p.health.tips[0] ?? 'Loopt goed'}</span>
                    </span>
                    <span style={{ width: 84, flex: 'none' }}>
                      <Sparkline values={p.spark} height={22} label="Activiteit, 14 dagen" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="notice row between">
            <span>Zet je projecten erin: dan komen er taken, plannen en concepten.</span>
            <Link href="/projects" className="button primary small">
              Projecten toevoegen
            </Link>
          </section>
        )}
      </details>
    </div>
  )
}
