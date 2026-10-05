import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { parseResults, type SeenResult } from '@/lib/visibility'
import { getSetting } from './settings'

/** The questions customers really ask, from the newest search plan; at most 25. */
export async function customerQuestions(db: Db, projectId: string): Promise<string[]> {
  const [row] = await db
    .select({ content: s.brief.content })
    .from(s.brief)
    .where(and(eq(s.brief.projectId, projectId), eq(s.brief.kind, 'seo')))
    .orderBy(desc(s.brief.createdAt))
    .limit(1)
  const questions = (row?.content as { questions?: unknown } | undefined)?.questions
  return Array.isArray(questions) ? questions.map(String).slice(0, 25) : []
}

/** His monthly "Word je gevonden?" results for a project, newest first. */
export async function seenHistory(db: Db, ownerId: string, projectId: string): Promise<SeenResult[]> {
  return parseResults(await getSetting(db, ownerId, `seen_${projectId}`))
}
