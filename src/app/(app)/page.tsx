import Link from 'next/link'
import { HealthRing } from '@/components/HealthRing'
import { Icon } from '@/components/Icon'
import { QuestItem } from '@/components/QuestItem'
import { Sparkline } from '@/components/Sparkline'
import { AskClaude } from '@/components/AskClaude'
import { PaceChip } from '@/components/GrowthCard'
import { NextSteps, SetupChecklist } from '@/components/NextSteps'
import { DayPath } from '@/components/DayPath'
import { WeeklyFocus } from '@/components/WeeklyFocus'
import { getDb } from '@/db'
import { greeting } from '@/lib/dates'
import { pickSteps } from '@/lib/today'
import { claudeBlocked } from '@/server/claude-status'
import { dailyRound, playerStats, projectPulses } from '@/server/game'
import { growthStates } from '@/server/growth-state'
import { outcomeStates } from '@/server/outcome-state'
import { questViews } from '@/server/quest-views'
import { requireOwner } from '@/server/session'
import { setupSteps } from '@/server/setup'
import { dayCandidates, dayProgress, growthStep, orderNextSteps } from '@/server/today'

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
  const { level, actionStreak, buildStreak } = stats
  // The day route: the first growth step of the least healthy project closes the list.
  const daySteps = pickSteps(await dayCandidates(db, owner.userId, growthStep(ordered)), new Set(), 8)
  const progress = await dayProgress(db, owner.userId)

  return (
    <div className="stack-l">
      <section className="hero hero-compact">
        <div className="stack-s">
          <p className="eyebrow" style={{ color: '#b5f23d' }}>
            Vandaag
          </p>
          <h1>{owner.name ? `${greeting(new Date())}, ${owner.name.split(' ')[0]}` : greeting(new Date())}</h1>
          <div className="row">
            <span className="chip flame" title="Dagen op rij iets gedaan (één vrije dag per week)">
              <Icon name="flame" size={14} /> {actionStreak.length} {actionStreak.length === 1 ? 'dag' : 'dagen'} actie{actionStreak.length && !actionStreak.today ? ' · vandaag nog niet' : ''}
            </span>
            <span className="chip" title="Dagen op rij gecommit">
              <Icon name="branch" size={14} /> {buildStreak.length} {buildStreak.length === 1 ? 'dag' : 'dagen'} bouwen
            </span>
            <span className="chip xp num">+{stats.todayXp} XP vandaag</span>
          </div>
        </div>
        <div className="row nowrap hero-level">
          <div className="level-badge num" aria-hidden="true">
            {level.level}
          </div>
          <div className="grow stack-xs">
            <p style={{ fontWeight: 700 }}>
              Level {level.level} · {level.title}
            </p>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={level.needed} aria-valuenow={level.current} aria-label="XP naar het volgende level">
              <span style={{ width: `${Math.round(level.progress * 100)}%` }} />
            </div>
            <p className="tiny muted num">
              {level.current} / {level.needed} XP naar level {level.level + 1}
            </p>
          </div>
        </div>
      </section>

      {setupLeft ? <SetupChecklist steps={setup} /> : null}

      <DayPath steps={daySteps} done={progress.done} goal={progress.goal} />

      {/* Everything else stays quiet behind one button: the day route is the page. */}
      <details className="more stack-l">
        <summary className="button secondary">Meer</summary>
        <AskClaude projects={pulses.map((p) => ({ id: p.id, name: p.name }))} disabledReason={blocked} />

        {pulses.length ? <NextSteps groups={ordered.slice(0, 5).map((g) => ({ key: g.key, title: g.title, why: g.why, projects: g.projects }))} disabledReason={blocked} /> : null}

        {pulses.length ? <WeeklyFocus db={db} ownerId={owner.userId} disabledReason={blocked} /> : null}

        <section className="card stack-s">
          <div className="row between">
            <h2>Quests</h2>
            <Link href="/quests" className="button ghost small">
              Alle quests <Icon name="arrow" size={16} />
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
              Geen open quests. <Link href="/quests">Zet er een op</Link>
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
            <span>Zet je projecten erin: dan komen er quests, plannen en concepten.</span>
            <Link href="/projects" className="button primary small">
              Projecten toevoegen
            </Link>
          </section>
        )}
      </details>
    </div>
  )
}
