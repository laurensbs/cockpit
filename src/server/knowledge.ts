import 'server-only'
import { and, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { knowledgeSig, parseStamp, refreshDue } from '@/lib/knowledge'
import { claudeLoggedIn, launchPrompt, runHeadless } from './claude'
import { compassStamp } from './compass'
import { createTicket } from './mcp/tickets'
import { getSetting, setSetting } from './settings'

/** Two projects per round at most, so a busy morning of pushes does not start a crowd of runs. */
const PER_ROUND = 2

/**
 * Staying up to date: for each project he pushed to (or whose STAND.md changed) since Claude last read
 * it, Claude reads what is new in the background and updates the intake: a new name, offer, stage or
 * site. Runs after every GitHub check (every ten minutes while the app runs) and in the daily round.
 */
export async function maybeRefresh(db: Db, ownerId: string, now = new Date()): Promise<string[]> {
  const projects = await db.select({ id: s.project.id, name: s.project.name, localPath: s.project.localPath }).from(s.project).where(eq(s.project.ownerId, ownerId))
  const repos = await db
    .select({ projectId: s.repo.projectId, pushedAt: s.repo.pushedAt })
    .from(s.repo)
    .where(and(eq(s.repo.ownerId, ownerId), eq(s.repo.includeInAi, true)))
  const due: { id: string; name: string; sig: string }[] = []
  for (const p of projects) {
    const sig = knowledgeSig(
      repos.filter((r) => r.projectId === p.id).map((r) => r.pushedAt),
      compassStamp(p),
    )
    if (refreshDue(parseStamp(await getSetting(db, ownerId, `knowledge_${p.id}`)), sig, now)) due.push({ id: p.id, name: p.name, sig })
  }
  if (!due.length || (await claudeLoggedIn()) === false) return []
  const started: string[] = []
  for (const p of due.slice(0, PER_ROUND)) {
    const ticket = createTicket({ task: 'refresh', projectId: p.id, options: {} })
    if (!(await runHeadless(launchPrompt(ticket))).started) continue
    await setSetting(db, ownerId, `knowledge_${p.id}`, JSON.stringify({ sig: p.sig, at: now.toISOString() }))
    started.push(p.name)
  }
  return started
}
