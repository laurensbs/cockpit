import Link from 'next/link'
import { HealthRing } from '@/components/HealthRing'
import { Icon } from '@/components/Icon'
import { QuestItem } from '@/components/QuestItem'
import { Sparkline } from '@/components/Sparkline'
import { getDb } from '@/db'
import { greeting } from '@/lib/dates'
import { dailyRound, playerStats, projectPulses } from '@/server/game'
import { questViews } from '@/server/quest-views'
import { requireOwner } from '@/server/session'

const TREND = { up: { icon: '▲', label: 'meer dan vorige week', color: 'var(--good)' }, down: { icon: '▼', label: 'minder dan vorige week', color: 'var(--bad)' }, flat: { icon: '●', label: 'gelijk aan vorige week', color: 'var(--faint)' } }

export default async function TodayPage() {
  const owner = await requireOwner()
  const db = await getDb()
  await dailyRound(db, owner.userId)
  const [stats, quests, pulses] = await Promise.all([playerStats(db, owner.userId), questViews(db, owner.userId, { status: 'open', limit: 50 }), projectPulses(db, owner.userId)])
  const now = quests.filter((q) => q.bucket === 'overdue' || q.bucket === 'today' || q.kind === 'boss').slice(0, 5)
  const shown = now.length >= 3 ? now : [...now, ...quests.filter((q) => !now.includes(q))].slice(0, 3)
  const { level, actionStreak, buildStreak } = stats

  return (
    <div className="stack-l">
      <section className="hero stack-m">
        <div className="row between">
          <p className="eyebrow" style={{ color: '#b5f23d' }}>
            Vandaag
          </p>
          <span className="chip xp num">+{stats.todayXp} XP vandaag</span>
        </div>
        <h1>
          {greeting(new Date())}, {owner.name.split(' ')[0]}
        </h1>
        <div className="row nowrap" style={{ gap: '1rem' }}>
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
        <div className="row">
          <span className="chip flame" title="Dagen op rij iets gedaan (één vrije dag per week)">
            <Icon name="flame" size={14} /> {actionStreak.length} {actionStreak.length === 1 ? 'dag' : 'dagen'} actie{actionStreak.length && !actionStreak.today ? ' · vandaag nog niet' : ''}
          </span>
          <span className="chip" title="Dagen op rij gecommit">
            <Icon name="branch" size={14} /> {buildStreak.length} {buildStreak.length === 1 ? 'dag' : 'dagen'} bouwen
          </span>
        </div>
      </section>

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
