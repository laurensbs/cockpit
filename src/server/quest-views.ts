import 'server-only'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { QuestView } from '@/components/QuestItem'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayLabel, dayOf } from '@/lib/dates'
import { bucketOf, type QuestBucket } from '@/lib/quests'

function dueLabel(dueOn: string | null, today: string): string | null {
  if (!dueOn) return null
  if (dueOn === today) return 'vandaag'
  if (dueOn === addDays(today, 1)) return 'morgen'
  if (dueOn < today) return `te laat · ${dayLabel(dueOn)}`
  return dayLabel(dueOn)
}

export type BucketedQuest = QuestView & { bucket: QuestBucket }

const ORDER: QuestBucket[] = ['overdue', 'today', 'week', 'later', 'someday']

/** Quests as the UI shows them, with project, due label and board column. */
export async function questViews(
  db: Db,
  ownerId: string,
  opts: { status: 'open' | 'closed'; projectId?: string; limit?: number },
): Promise<BucketedQuest[]> {
  const today = dayOf(new Date())
  const rows = await db
    .select({ quest: s.quest, projectName: s.project.name, color: s.company.color })
    .from(s.quest)
    .leftJoin(s.project, eq(s.project.id, s.quest.projectId))
    .leftJoin(s.company, eq(s.company.id, s.project.companyId))
    .where(
      and(
        eq(s.quest.ownerId, ownerId),
        opts.status === 'open' ? eq(s.quest.status, 'open') : inArray(s.quest.status, ['done', 'skipped']),
        ...(opts.projectId ? [eq(s.quest.projectId, opts.projectId)] : []),
      ),
    )
    .orderBy(opts.status === 'open' ? asc(s.quest.dueOn) : desc(s.quest.doneAt), desc(s.quest.createdAt))
    .limit(opts.limit ?? 200)
  const views = rows.map(({ quest: q, projectName, color }) => ({
    id: q.id,
    title: q.title,
    detail: q.detail,
    xp: q.xp,
    kind: q.kind,
    status: q.status,
    dueLabel: dueLabel(q.dueOn, today),
    overdue: q.status === 'open' && q.dueOn != null && q.dueOn < today,
    recurring: q.recurrence !== 'none',
    project: q.projectId && projectName ? { id: q.projectId, name: projectName, color: color ?? '#8a90b0' } : null,
    bucket: bucketOf(q.dueOn, today),
  }))
  if (opts.status === 'closed') return views
  // Open quests: by column, the boss first within a column.
  return views.sort((a, b) => ORDER.indexOf(a.bucket) - ORDER.indexOf(b.bucket) || (a.kind === 'boss' ? -1 : 0) - (b.kind === 'boss' ? -1 : 0))
}
