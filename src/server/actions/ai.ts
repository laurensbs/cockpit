'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { planFromJson, profileFromJson } from '@/lib/ai/schemas'
import { addDays, dayOf, weekStart } from '@/lib/dates'
import { BOSS_XP } from '@/lib/game'
import { isJobKind } from '../ai/jobs'
import { startJob } from '../ai/run'
import { actionOwner } from '../session'

/** Starts an AI job for a project; the page polls the run until it is done. */
export async function startAi(kind: string, projectId: string, options: Record<string, unknown> = {}): Promise<{ runId?: string; error?: string }> {
  const owner = await actionOwner()
  if (!isJobKind(kind)) return { error: 'Onbekende taak.' }
  const result = await startJob(owner.userId, kind, String(projectId), options)
  return 'runId' in result ? { runId: result.runId } : { error: result.error }
}

/**
 * Chosen plan actions become quests, due in the week the plan gave them. The first big one becomes
 * the boss of its week when no boss is open yet.
 */
export async function acceptPlanActions(briefId: string, actionIds: string[]): Promise<{ added: number }> {
  const owner = await actionOwner()
  const ids = z.array(z.string().max(16)).max(30).safeParse(actionIds)
  if (!ids.success || !ids.data.length) return { added: 0 }
  const db = await getDb()
  const [brief] = await db
    .select()
    .from(s.brief)
    .where(and(eq(s.brief.id, String(briefId)), eq(s.brief.ownerId, owner.userId), eq(s.brief.kind, 'plan')))
  const plan = brief ? planFromJson(brief.content) : null
  if (!brief || !plan) return { added: 0 }
  const openBoss = await db
    .select({ id: s.quest.id })
    .from(s.quest)
    .where(and(eq(s.quest.ownerId, owner.userId), eq(s.quest.kind, 'boss'), eq(s.quest.status, 'open')))
  let bossLeft = openBoss.length === 0
  const start = weekStart(dayOf(brief.createdAt))
  const chosen = plan.phases.flatMap((p) => p.actions).filter((a) => ids.data.includes(a.id))
  let added = 0
  for (const action of chosen) {
    const boss = bossLeft && action.effort === 'L'
    if (boss) bossLeft = false
    const rows = await db
      .insert(s.quest)
      .values({
        id: crypto.randomUUID(),
        ownerId: owner.userId,
        projectId: brief.projectId,
        title: action.title,
        detail: action.why,
        kind: boss ? 'boss' : 'custom',
        xp: boss ? BOSS_XP : action.xp,
        source: 'ai',
        sourceKey: `plan:${brief.id}:${action.id}`,
        dueOn: addDays(start, (action.week - 1) * 7 + 4),
      })
      .onConflictDoNothing()
      .returning({ id: s.quest.id })
    added += rows.length
  }
  revalidatePath('/')
  revalidatePath('/quests')
  if (brief.projectId) revalidatePath(`/projects/${brief.projectId}/brain`)
  return { added }
}

/** A quick win from the profile becomes a small quest for this week. */
export async function acceptQuickWin(briefId: string, index: number): Promise<{ added: boolean }> {
  const owner = await actionOwner()
  const db = await getDb()
  const [brief] = await db
    .select()
    .from(s.brief)
    .where(and(eq(s.brief.id, String(briefId)), eq(s.brief.ownerId, owner.userId), eq(s.brief.kind, 'profile')))
  const profile = brief ? profileFromJson(brief.content) : null
  const win = profile?.quickWins[Number(index)]
  if (!brief || !win) return { added: false }
  const rows = await db
    .insert(s.quest)
    .values({
      id: crypto.randomUUID(),
      ownerId: owner.userId,
      projectId: brief.projectId,
      title: win,
      kind: 'custom',
      xp: 10,
      source: 'ai',
      sourceKey: `win:${brief.id}:${index}`,
      dueOn: addDays(dayOf(new Date()), 6),
    })
    .onConflictDoNothing()
    .returning({ id: s.quest.id })
  revalidatePath('/')
  revalidatePath('/quests')
  if (brief.projectId) revalidatePath(`/projects/${brief.projectId}/brain`)
  return { added: rows.length > 0 }
}
