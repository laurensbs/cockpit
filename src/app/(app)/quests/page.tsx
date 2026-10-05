import { asc, desc, eq } from 'drizzle-orm'
import { Icon } from '@/components/Icon'
import { QuestForm } from '@/components/QuestForm'
import { QuestItem } from '@/components/QuestItem'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { dayLabel } from '@/lib/dates'
import { BADGES, earnedBadges } from '@/lib/game'
import type { QuestBucket } from '@/lib/quests'
import { badgeStats, dailyRound, playerStats } from '@/server/game'
import { questViews } from '@/server/quest-views'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Quests' }

const COLUMNS: { key: QuestBucket; title: string }[] = [
  { key: 'overdue', title: 'Te laat' },
  { key: 'today', title: 'Vandaag' },
  { key: 'week', title: 'Deze week' },
  { key: 'later', title: 'Later' },
  { key: 'someday', title: 'Ooit' },
]

const KIND_LABELS: Record<string, string> = {
  quest: 'Quest',
  post: 'Post geplaatst',
  email: 'Mail verstuurd',
  reply: 'Antwoord gekregen',
  commitDay: 'Gebouwd',
  metric: 'Cijfers ingevuld',
  intake: 'Intake af',
  plan: 'Plan gemaakt',
  generate: 'Concepten gemaakt',
  experiment: 'Experiment afgerond',
}

export default async function QuestsPage() {
  const owner = await requireOwner('/quests')
  const db = await getDb()
  await dailyRound(db, owner.userId)
  const [open, closed, stats, badges, projects, history] = await Promise.all([
    questViews(db, owner.userId, { status: 'open' }),
    questViews(db, owner.userId, { status: 'closed', limit: 15 }),
    playerStats(db, owner.userId),
    badgeStats(db, owner.userId),
    db.select({ id: s.project.id, name: s.project.name }).from(s.project).where(eq(s.project.ownerId, owner.userId)).orderBy(asc(s.project.sortOrder)),
    db
      .select({ kind: s.xpEvent.kind, xp: s.xpEvent.xp, day: s.xpEvent.day, projectName: s.project.name })
      .from(s.xpEvent)
      .leftJoin(s.project, eq(s.project.id, s.xpEvent.projectId))
      .where(eq(s.xpEvent.ownerId, owner.userId))
      .orderBy(desc(s.xpEvent.createdAt))
      .limit(12),
  ])
  const earned = new Set(earnedBadges(badges))

  return (
    <div className="stack-l">
      <header className="row between">
        <div className="stack-xs">
          <h1>Quests</h1>
          <p className="muted small num">
            Level {stats.level.level} · {stats.totalXp} XP · {open.length} open
          </p>
        </div>
        <a href="#nieuw" className="button primary small">
          <Icon name="plus" size={16} /> Quest
        </a>
      </header>

      {COLUMNS.map((col) => {
        const list = open.filter((q) => q.bucket === col.key)
        if (!list.length) return null
        return (
          <section key={col.key} className="card stack-s">
            <h2>
              {col.title} <span className="faint num">{list.length}</span>
            </h2>
            <ul className="list" style={{ margin: 0 }}>
              {list.map((q) => (
                <QuestItem key={q.id} quest={q} />
              ))}
            </ul>
          </section>
        )
      })}
      {open.length ? null : <p className="empty">Alles gedaan. Zet een nieuwe quest op, of laat Claude er een paar maken.</p>}

      <section id="nieuw" className="card stack-m">
        <h2>Nieuwe quest</h2>
        <QuestForm projects={projects} />
      </section>

      <section className="stack-m">
        <h2>Badges</h2>
        <ul className="badges">
          {BADGES.map((b) => (
            <li key={b.key} className={`card flat badge${earned.has(b.key) ? ' earned' : ''}`}>
              <span className="badge-icon" aria-hidden="true">
                <Icon name={earned.has(b.key) ? 'trophy' : 'shield'} size={20} />
              </span>
              <strong>{b.title}</strong>
              <span className="tiny muted">{b.description}</span>
            </li>
          ))}
        </ul>
      </section>

      {closed.length ? (
        <section className="card stack-s">
          <h2>Afgerond</h2>
          <ul className="list" style={{ margin: 0 }}>
            {closed.map((q) => (
              <QuestItem key={q.id} quest={q} />
            ))}
          </ul>
        </section>
      ) : null}

      {history.length ? (
        <section className="card stack-s">
          <h2>XP-historie</h2>
          <ul className="list small">
            {history.map((h, i) => (
              <li key={i} className="row between">
                <span>
                  {KIND_LABELS[h.kind] ?? h.kind}
                  {h.projectName ? <span className="muted"> · {h.projectName}</span> : null}
                </span>
                <span className="row nowrap">
                  <span className="tiny faint">{dayLabel(h.day)}</span>
                  <span className="chip xp num">+{h.xp}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
