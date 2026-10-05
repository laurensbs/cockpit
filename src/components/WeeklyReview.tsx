import { and, desc, eq, isNull, like } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { type Review, reviewFromJson } from '@/lib/ai/schemas'
import { dayLabel, dayOf, weekStart } from '@/lib/dates'
import type { GrowthModel } from '@/lib/growth-model'
import { formatMetric, metricName } from '@/lib/metrics'
import { reviewWeek } from '@/server/review'
import { ClaudeButton } from './ClaudeButton'
import { ReviewButton } from './ReviewButtons'

const GROUPS: { kind: Review['decisions'][number]['kind']; label: string }[] = [
  { kind: 'stop', label: 'Stoppen' },
  { kind: 'continue', label: 'Doorgaan' },
  { kind: 'start', label: 'Beginnen' },
]

/** Looking back on last week, made with one press: what it brought, and what to stop, continue and start. */
export async function WeeklyReview({ db, ownerId, disabledReason }: { db: Db; ownerId: string; disabledReason: string | null }) {
  const today = dayOf(new Date())
  const [brief] = await db
    .select()
    .from(s.brief)
    .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'review'), isNull(s.brief.projectId)))
    .orderBy(desc(s.brief.createdAt))
    .limit(1)
  const review = brief && dayOf(brief.createdAt) >= weekStart(today) ? reviewFromJson(brief.content) : null
  if (!brief || !review) {
    const { from, to } = reviewWeek(today)
    return (
      <section className="card stack-s">
        <h2>Weekreview</h2>
        <p className="small muted">
          Claude kijkt terug op de afgelopen zeven dagen ({dayLabel(from)} tot en met {dayLabel(to)}): je cijfers, posts, deals, experimenten en quests. Daarna zegt hij per project wat je moet stoppen, doorzetten of beginnen. Jij kiest wat je overneemt.
        </p>
        <ClaudeButton task="review" projectId={null} label="Maak de weekreview" disabledReason={disabledReason} variant="secondary" />
      </section>
    )
  }
  const [quests, lessons, projects] = await Promise.all([
    db
      .select({ sourceKey: s.quest.sourceKey })
      .from(s.quest)
      .where(and(eq(s.quest.ownerId, ownerId), like(s.quest.sourceKey, `review:${brief.id}:%`))),
    db
      .select({ body: s.contentItem.body })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'lesson'), eq(s.contentItem.channel, 'review'))),
    db.select({ name: s.project.name, model: s.project.growthModel }).from(s.project).where(eq(s.project.ownerId, ownerId)),
  ])
  const questMade = (i: number) => quests.some((q) => q.sourceKey === `review:${brief.id}:${i}`)
  const lessonKept = (i: number) => lessons.some((l) => (l.body as { refId?: string }).refId === `${brief.id}:${i}`)
  const modelOf = (name: string) => projects.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())?.model as GrowthModel | null | undefined
  return (
    <section className="card stack-m weekly" aria-labelledby="review-title">
      <div className="stack-xs">
        <p className="eyebrow">Weekreview</p>
        <h2 id="review-title">{review.headline}</h2>
      </div>
      {review.wins.length || review.misses.length ? (
        <div className="review-columns">
          {review.wins.length ? (
            <div className="stack-xs">
              <strong className="small">Ging goed</strong>
              <ul className="small review-list">
                {review.wins.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.misses.length ? (
            <div className="stack-xs">
              <strong className="small">Bleef liggen</strong>
              <ul className="small review-list">
                {review.misses.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {review.numbers ? <p className="small">{review.numbers}</p> : null}
      {GROUPS.map((g) => {
        const items = review.decisions.map((d, i) => ({ ...d, i })).filter((d) => d.kind === g.kind)
        if (!items.length) return null
        return (
          <div key={g.kind} className="stack-s">
            <h3>{g.label}</h3>
            <ul className="stack-s review-list plain">
              {items.map((d) => (
                <li key={d.i} className="stack-xs">
                  <span className="small">
                    <strong>{d.what}</strong> <span className="muted">· {d.project}</span>
                  </span>
                  <span className="tiny muted">{d.why}</span>
                  <ReviewButton briefId={brief.id} index={d.i} what="quest" done={questMade(d.i)} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {review.lessons.length ? (
        <div className="stack-s">
          <h3>Lessen</h3>
          <ul className="stack-s review-list plain">
            {review.lessons.map((l, i) => (
              <li key={i} className="stack-xs">
                <span className="small">
                  {l.lesson} <span className="muted">· {l.project}</span>
                </span>
                <ReviewButton briefId={brief.id} index={i} what="lesson" done={lessonKept(i)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {review.targetChanges.length ? (
        <div className="stack-s">
          <h3>Doel bijstellen?</h3>
          <ul className="stack-s review-list plain">
            {review.targetChanges.map((c, i) => {
              const model = modelOf(c.project)
              const key = model?.northStar.key
              const applied = Boolean(model && model.northStar.target === c.target && model.northStar.deadline === c.deadline)
              return (
                <li key={i} className="stack-xs">
                  <span className="small">
                    <strong>{c.project}</strong>
                    {key ? (
                      <>
                        {' '}
                        · {metricName(key)}: {applied ? '' : `${formatMetric(key, model!.northStar.target)} op ${dayLabel(model!.northStar.deadline)} → `}
                        {formatMetric(key, c.target)} op {dayLabel(c.deadline)}
                      </>
                    ) : (
                      ' · nog geen doel'
                    )}
                  </span>
                  <span className="tiny muted">{c.why}</span>
                  {model ? <ReviewButton briefId={brief.id} index={i} what="target" done={applied} /> : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
