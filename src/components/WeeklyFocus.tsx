import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { weeklyFromJson } from '@/lib/ai/schemas'
import { dayOf, weekStart } from '@/lib/dates'
import { ClaudeButton } from './ClaudeButton'
import { Icon } from './Icon'
import { WeeklyBoss } from './WeeklyBoss'

/** This week's focus from Claude Code, made with one press on Monday (or whenever he likes). */
export async function WeeklyFocus({ db, ownerId, disabledReason }: { db: Db; ownerId: string; disabledReason: string | null }) {
  const [brief] = await db
    .select()
    .from(s.brief)
    .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'weekly'), isNull(s.brief.projectId)))
    .orderBy(desc(s.brief.createdAt))
    .limit(1)
  const thisWeek = brief && dayOf(brief.createdAt) >= weekStart(dayOf(new Date()))
  const weekly = thisWeek && brief ? weeklyFromJson(brief.content) : null
  if (!weekly || !brief) {
    return (
      <section className="card stack-s">
        <h2>Focus van de week</h2>
        <p className="small muted">Claude kijkt naar al je projecten (gezondheid, momentum, wat bleef liggen) en zegt waar je deze week heen moet.</p>
        <ClaudeButton task="weekly" projectId={null} label="Maak de weekfocus" disabledReason={disabledReason} />
      </section>
    )
  }
  const [accepted] = await db
    .select({ id: s.quest.id })
    .from(s.quest)
    .where(and(eq(s.quest.ownerId, ownerId), eq(s.quest.sourceKey, `weekly:${brief.id}`)))
  return (
    <section className="card stack-m weekly">
      <div className="stack-xs">
        <p className="eyebrow">Focus van de week</p>
        <h2>{weekly.headline}</h2>
      </div>
      <ol className="channels">
        {weekly.focus.map((f) => (
          <li key={f.project} className="stack-xs">
            <strong>{f.project}</strong>
            <p className="small">{f.why}</p>
            <p className="small">
              <strong>Vandaag:</strong> {f.firstStep}
            </p>
          </li>
        ))}
      </ol>
      <div className="card sunken stack-s">
        <p className="eyebrow">Hoofdtaak van de week</p>
        <p style={{ fontWeight: 700 }}>
          {weekly.boss.title} <span className="muted small">· {weekly.boss.project}</span>
        </p>
        <p className="small muted">{weekly.boss.why}</p>
        <WeeklyBoss briefId={brief.id} accepted={Boolean(accepted)} />
      </div>
      {weekly.wins.length ? (
        <p className="small">
          <Icon name="trophy" size={14} /> {weekly.wins.join(' · ')}
        </p>
      ) : null}
      {weekly.avoiding ? <p className="small muted">Wat je misschien uitstelt: {weekly.avoiding}</p> : null}
    </section>
  )
}
