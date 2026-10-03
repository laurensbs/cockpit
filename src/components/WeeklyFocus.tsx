import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { weeklyFromJson } from '@/lib/ai/schemas'
import { dayOf, weekStart } from '@/lib/dates'
import { budgetState } from '@/server/ai/budget'
import { loadPortfolioContext } from '@/server/ai/context'
import { JOBS } from '@/server/ai/jobs'
import { estimate } from '@/server/ai/run'
import { aiStatus } from '@/server/status'
import { AiButton } from './AiButton'
import { WeeklyBoss } from './WeeklyBoss'

/** This week's focus from Claude, made on Monday by the cron (when switched on) or with one tap. */
export async function WeeklyFocus({ db, ownerId }: { db: Db; ownerId: string }) {
  const [brief] = await db
    .select()
    .from(s.brief)
    .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'weekly'), isNull(s.brief.projectId)))
    .orderBy(desc(s.brief.createdAt))
    .limit(1)
  const thisWeek = brief && dayOf(brief.createdAt) >= weekStart(dayOf(new Date()))
  const weekly = thisWeek && brief ? weeklyFromJson(brief.content) : null
  const status = aiStatus()
  if (!weekly || !brief) {
    if (status === 'off') return null
    const [ctx, budget] = await Promise.all([loadPortfolioContext(db, ownerId), budgetState(db, ownerId)])
    const est = estimate(JOBS.weekly, ctx)
    return (
      <section className="card stack-s">
        <h2>Focus van de week</h2>
        <p className="small muted">Claude kijkt naar al je projecten (gezondheid, momentum, wat bleef liggen) en zegt waar je deze week heen moet.</p>
        <AiButton kind="weekly" projectId="" label="Maak de weekfocus" estimateMicros={est.typicalMicros} disabledReason={budget.remainingMicros < est.worstMicros ? 'Het AI-budget van deze maand is op.' : null} />
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
        <p className="eyebrow">Boss van de week</p>
        <p style={{ fontWeight: 700 }}>
          {weekly.boss.title} <span className="muted small">· {weekly.boss.project}</span>
        </p>
        <p className="small muted">{weekly.boss.why}</p>
        <WeeklyBoss briefId={brief.id} accepted={Boolean(accepted)} />
      </div>
      {weekly.wins.length ? <p className="small">🏆 {weekly.wins.join(' · ')}</p> : null}
      {weekly.avoiding ? <p className="small muted">🤔 {weekly.avoiding}</p> : null}
    </section>
  )
}
