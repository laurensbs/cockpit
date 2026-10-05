import Link from 'next/link'
import { HealthRing } from '@/components/HealthRing'
import { Icon } from '@/components/Icon'
import { QuestItem } from '@/components/QuestItem'
import { Sparkline } from '@/components/Sparkline'
import { AskClaude } from '@/components/AskClaude'
import { PaceChip } from '@/components/GrowthCard'
import { NextSteps, SetupChecklist, type NextStepGroup } from '@/components/NextSteps'
import { WeeklyFocus } from '@/components/WeeklyFocus'
import { WeeklyReview } from '@/components/WeeklyReview'
import { getDb } from '@/db'
import { dayOf, greeting } from '@/lib/dates'
import { ACTION_TASKS, actionHref, nextActions } from '@/lib/growth'
import { claudeBlocked } from '@/server/claude-status'
import { contentWeekSummary } from '@/server/content'
import { dailyRound, playerStats, projectPulses } from '@/server/game'
import { EMPTY_GROWTH, growthStates } from '@/server/growth-state'
import { outcomeHref, outcomeStates } from '@/server/outcome-state'
import { questViews } from '@/server/quest-views'
import { requireOwner } from '@/server/session'
import { setupSteps } from '@/server/setup'

const TREND = { up: { icon: '▲', label: 'meer dan vorige week', color: 'var(--good)' }, down: { icon: '▼', label: 'minder dan vorige week', color: 'var(--bad)' }, flat: { icon: '●', label: 'gelijk aan vorige week', color: 'var(--faint)' } }

export default async function TodayPage() {
  const owner = await requireOwner()
  const db = await getDb()
  await dailyRound(db, owner.userId)
  const outcomes = await outcomeStates(db, owner.userId)
  const [stats, quests, pulses, growth, blocked, content] = await Promise.all([
    playerStats(db, owner.userId),
    questViews(db, owner.userId, { status: 'open', limit: 50 }),
    projectPulses(db, owner.userId, new Date(), outcomes),
    growthStates(db, owner.userId),
    claudeBlocked(),
    contentWeekSummary(db, owner.userId, dayOf(new Date())),
  ])
  const setup = await setupSteps(db, owner.userId, pulses.length)
  const setupLeft = setup.some((step) => !step.done && !step.optional)
  // One step per project, the least healthy project first: that is where attention pays off most. What
  // the numbers say (the leak, a missing model or missing numbers) comes before the usual marketing
  // steps. The same step for several projects becomes one row.
  const groups: (NextStepGroup & { fromNumbers: boolean })[] = []
  for (const p of pulses) {
    const fromNumbers = outcomes.get(p.id)?.step
    const [first] = nextActions(growth.get(p.id) ?? EMPTY_GROWTH)
    const step = fromNumbers
      ? { key: fromNumbers.key, title: fromNumbers.title, why: fromNumbers.why, href: outcomeHref(p.id, fromNumbers.place), task: fromNumbers.task, options: fromNumbers.options }
      : first
        ? { key: first.key, title: first.title, why: first.why, href: actionHref(p.id, first.tab), task: ACTION_TASKS[first.key] ?? null, options: undefined }
        : null
    if (!step) continue
    const item = { projectId: p.id, projectName: p.name, color: p.color, href: step.href, task: step.task, options: step.options }
    // The same step with the same reason groups; a step with this project's numbers in its reason stands alone.
    const same = groups.find((g) => g.title === step.title && g.why === step.why)
    if (same) same.projects.push(item)
    else groups.push({ key: `${step.key}-${groups.length}`, title: step.title, why: step.why, projects: [item], fromNumbers: Boolean(fromNumbers) })
  }
  // What the numbers ask for comes first; the order within stays least healthy first.
  const ordered = [...groups.filter((g) => g.fromNumbers), ...groups.filter((g) => !g.fromNumbers)]
  const now = quests.filter((q) => q.bucket === 'overdue' || q.bucket === 'today' || q.kind === 'boss').slice(0, 5)
  const shown = now.length >= 3 ? now : [...now, ...quests.filter((q) => !now.includes(q))].slice(0, 3)
  const { level, actionStreak, buildStreak } = stats

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

      <AskClaude projects={pulses.map((p) => ({ id: p.id, name: p.name }))} disabledReason={blocked} />

      {pulses.length ? <NextSteps groups={ordered.slice(0, 5).map((g) => ({ key: g.key, title: g.title, why: g.why, projects: g.projects }))} disabledReason={blocked} /> : null}

      {content.ready || content.dueToday ? (
        <Link href="/content" className="notice row between content-nudge">
          <span>
            <strong>Contentweek</strong> · {content.ready ? `${content.ready} klaar om goed te keuren` : ''}
            {content.ready && content.dueToday ? ', ' : ''}
            {content.dueToday ? `${content.dueToday} vandaag te plaatsen` : ''}
          </span>
          <Icon name="arrow" size={18} />
        </Link>
      ) : null}

      {pulses.length ? <WeeklyReview db={db} ownerId={owner.userId} disabledReason={blocked} /> : null}
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
    </div>
  )
}
