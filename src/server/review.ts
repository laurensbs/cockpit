import 'server-only'
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { ReviewProjectInput } from '@/lib/ai/prompts'
import { weeklyFromJson } from '@/lib/ai/schemas'
import { addDays, dayOf } from '@/lib/dates'
import { bucketWeeks, formatMetric, isMetricKey, lastWeeks, METRIC_DEFS, METRIC_KEYS } from '@/lib/metrics'
import { ACTIVE_STAGES, CONTACT_STATUS_LABELS, type ContactStatus } from '@/lib/options'
import { hasStats, postLine, RESULT_DAYS } from '@/lib/post-stats'
import { BOARD_LABELS, dueOf, OPEN_STAGES, worthOf, worthText } from '@/lib/pipeline-board'
import { performanceFor, publishedPosts } from './content-results'
import { bottleneckLine, lessonLine, type LessonBody, outcomeStates, paceLine } from './outcome-state'
import { dailySeries, loadPoints } from './points'

// The raw material of the weekly review: per active project what the last week brought (numbers,
// quests, posts, deals, experiments, mails), and the focus he set for it. Only facts from the cockpit.

export interface ReviewInput {
  from: string
  to: string
  today: string
  lastFocus: string | null
  projects: ReviewProjectInput[]
}

/** The week to look back on: the last seven days, today included (on a Monday: the week that just ended). */
export function reviewWeek(today: string): { from: string; to: string } {
  return { from: addDays(today, -6), to: today }
}

export async function reviewInput(db: Db, ownerId: string, now = new Date()): Promise<ReviewInput> {
  const today = dayOf(now)
  const { from, to } = reviewWeek(today)
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${addDays(to, 1)}T00:00:00Z`)
  const projects = (await db.select().from(s.project).where(eq(s.project.ownerId, ownerId))).filter((p) => (ACTIVE_STAGES as readonly string[]).includes(p.stage))
  const ids = projects.map((p) => p.id)
  // Three full weeks and this week so far.
  const weeks = lastWeeks(addDays(today, 7), 4)
  const [outcomes, points, quests, events, contacts, lessons, running, mails, weekly] = await Promise.all([
    outcomeStates(db, ownerId, now),
    loadPoints(db, ownerId, addDays(weeks[0], -1), { projectIds: ids }),
    db
      .select({ projectId: s.quest.projectId, title: s.quest.title, status: s.quest.status, dueOn: s.quest.dueOn, doneAt: s.quest.doneAt })
      .from(s.quest)
      .where(eq(s.quest.ownerId, ownerId)),
    ids.length
      ? db
          .select({ projectId: s.contactEvent.projectId, contactId: s.contactEvent.contactId, status: s.contactEvent.status, day: s.contactEvent.day })
          .from(s.contactEvent)
          .where(and(eq(s.contactEvent.ownerId, ownerId), gte(s.contactEvent.day, from)))
      : [],
    ids.length
      ? db
          .select({ id: s.contact.id, projectId: s.contact.projectId, organization: s.contact.organization, status: s.contact.status, value: s.contact.dealValue, period: s.contact.dealPeriod, nextStepOn: s.contact.nextStepOn })
          .from(s.contact)
          .where(and(eq(s.contact.ownerId, ownerId), inArray(s.contact.projectId, ids)))
      : [],
    db
      .select({ projectId: s.contentItem.projectId, title: s.contentItem.title, body: s.contentItem.body, createdAt: s.contentItem.createdAt })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'lesson'), gte(s.contentItem.createdAt, start))),
    db
      .select({ projectId: s.contentItem.projectId, title: s.contentItem.title, body: s.contentItem.body })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'experiment'), eq(s.contentItem.status, 'planned'))),
    db
      .select({ projectId: s.emailJob.projectId, contactId: s.emailJob.contactId, sentAt: s.emailJob.sentAt })
      .from(s.emailJob)
      .where(and(eq(s.emailJob.ownerId, ownerId), eq(s.emailJob.status, 'sent'), gte(s.emailJob.sentAt, start))),
    db
      .select({ content: s.brief.content, createdAt: s.brief.createdAt })
      .from(s.brief)
      .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'weekly'), isNull(s.brief.projectId), gte(s.brief.createdAt, start)))
      .orderBy(desc(s.brief.createdAt)),
  ])
  const inWeek = (d: Date | null) => Boolean(d && d >= start && d < end)
  const focus = weekly.filter((w) => w.createdAt < end).map((w) => weeklyFromJson(w.content)).find(Boolean)
  const lastFocus = focus ? `${focus.headline} Boss: ${focus.boss.title} (${focus.boss.project}).` : null

  const out: ReviewProjectInput[] = []
  for (const p of projects) {
    const o = outcomes.get(p.id)
    const numbers = METRIC_KEYS.filter((key) => points.some((r) => r.projectId === p.id && r.key === key))
      .slice(0, 10)
      .map((key) => {
        const values = bucketWeeks(dailySeries(points, p.id, key), METRIC_DEFS[key], weeks)
        return `${key} (${METRIC_DEFS[key].agg === 'sum' ? 'weekly total' : 'end of week'}): ${values.map((v) => (v == null ? '–' : formatMetric(key, Math.round(v * 100) / 100))).join(', ')}`
      })
    const own = quests.filter((q) => q.projectId === p.id)
    const posts = (await publishedPosts(db, ownerId, now, [p.id])).filter((x) => x.day >= from && x.day <= to)
    const performance = await performanceFor(db, ownerId, p.id, now)
    const moves = events.filter((e) => e.projectId === p.id && e.day >= from && e.day <= to)
    const deals = contacts.filter((c) => c.projectId === p.id)
    const open = deals.filter((c) => (OPEN_STAGES as readonly string[]).includes(c.status))
    const late = open.filter((c) => dueOf({ status: c.status, nextStepOn: c.nextStepOn }, today) === 'late').length
    const sent = mails.filter((m) => m.projectId === p.id && inWeek(m.sentAt))
    out.push({
      name: p.name,
      stage: p.stage,
      growth: o?.model && o.pace ? `${paceLine(o.model, o.pace)}${bottleneckLine(o) ? `; ${bottleneckLine(o)}` : ''}` : null,
      numbers,
      done: own.filter((q) => q.status === 'done' && inWeek(q.doneAt)).map((q) => q.title).slice(0, 12),
      skipped: [
        ...own.filter((q) => q.status === 'skipped' && inWeek(q.doneAt)).map((q) => q.title),
        ...own.filter((q) => q.status === 'open' && q.dueOn && q.dueOn <= to).map((q) => `${q.title} (overdue)`),
      ].slice(0, 10),
      content: [
        ...(posts.length ? posts.slice(0, 10).map((x) => `${x.channel}: ${hasStats(x.stats) ? postLine(x) : `"${x.hook}" (${x.format}, ${x.day}): no numbers yet`}`) : ['No posts went out this week.']),
        ...(performance ? [`What works (last ${RESULT_DAYS} days): ${performance.join(' / ')}`] : []),
      ],
      pipeline: deals.length
        ? [
            ...(moves.length
              ? [
                  `This week: ${Object.entries(
                    moves.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.status]: (acc[e.status] ?? 0) + 1 }), {}),
                  )
                    .map(([status, n]) => `${n}× ${BOARD_LABELS[status as keyof typeof BOARD_LABELS] ?? CONTACT_STATUS_LABELS[status as ContactStatus] ?? status}`)
                    .join(', ')}`,
                ]
              : ['No deal moved this week.']),
            ...moves.filter((e) => e.status === 'won').map((e) => {
              const c = deals.find((d) => d.id === e.contactId)
              return `Won: ${c?.organization ?? 'a deal'}${c?.value != null ? ` (${worthText(worthOf([c]))})` : ''}`
            }),
            `Open: ${open.length} deal${open.length === 1 ? '' : 's'}, ${worthText(worthOf(open))}${late ? `; ${late} next step${late === 1 ? '' : 's'} late` : ''}`,
          ]
        : [],
      experiments: [
        ...lessons
          .filter((l) => l.projectId === p.id && inWeek(l.createdAt) && (l.body as LessonBody).source !== 'review')
          .map((l) => `Finished: ${lessonLine(l.title, l.body as LessonBody)}`),
        ...running
          .filter((e) => e.projectId === p.id)
          .map((e) => {
            const b = e.body as { endsOn?: string; metricKey?: string }
            return `Running: ${e.title}${b.metricKey && isMetricKey(b.metricKey) ? ` (moves ${b.metricKey})` : ''}${b.endsOn ? `, ends ${b.endsOn}` : ''}`
          }),
      ],
      mails: sent.length ? `${sent.length} sent to ${new Set(sent.map((m) => m.contactId)).size} contacts this week` : null,
    })
  }
  return { from, to, today, lastFocus, projects: out }
}
