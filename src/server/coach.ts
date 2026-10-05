import 'server-only'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import type { z } from 'zod'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { type CoachAdvice, coachFromJson, type CoachWire } from '@/lib/coach'

/** Stores one advice; the newest one per project (or across everything) is the one that counts. */
export async function saveCoach(db: Db, ownerId: string, project: { id: string; name: string } | null, advice: z.infer<typeof CoachWire>): Promise<string> {
  await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId, projectId: project?.id ?? null, kind: 'coach', content: { ...advice, steps: advice.steps.slice(0, 5) } })
  return `Opgeslagen: "${advice.title}"${project ? ` voor ${project.name}` : ''}. Hij ziet het op Vandaag${project ? ' en op de projectpagina' : ''}.`
}

export interface CoachView {
  advice: CoachAdvice
  projectId: string | null
  projectName: string | null
  at: Date
}

/** The newest advice of the last week: for one project, or the newest of all (what to do now). */
export async function latestCoach(db: Db, ownerId: string, projectId?: string): Promise<CoachView | null> {
  const since = new Date(Date.now() - 7 * 86_400_000)
  const rows = await db
    .select({ content: s.brief.content, projectId: s.brief.projectId, createdAt: s.brief.createdAt })
    .from(s.brief)
    .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'coach'), gte(s.brief.createdAt, since), ...(projectId ? [eq(s.brief.projectId, projectId)] : [])))
    .orderBy(desc(s.brief.createdAt))
    .limit(10)
  for (const row of rows) {
    const advice = coachFromJson(row.content)
    if (!advice) continue
    const [p] = row.projectId ? await db.select({ name: s.project.name }).from(s.project).where(inArray(s.project.id, [row.projectId])) : []
    return { advice, projectId: row.projectId, projectName: p?.name ?? null, at: row.createdAt }
  }
  return null
}
