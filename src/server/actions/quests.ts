'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { BADGES, BOSS_XP, earnedBadges, levelFor, QUEST_XP } from '@/lib/game'
import { nextDue, RECURRENCES, type Recurrence } from '@/lib/quests'
import { badgeStats } from '../game'
import { actionOwner } from '../session'
import { award, revoke, totalXp } from '../xp'
import type { FormState } from './types'

export interface QuestResult {
  ok: boolean
  xp: number
  level: number
  levelUp: { level: number; title: string } | null
  badges: { key: string; title: string; description: string }[]
}

function refresh(projectId: string | null) {
  revalidatePath('/')
  revalidatePath('/quests')
  if (projectId) revalidatePath(`/projects/${projectId}`)
}

/** Done: XP in, the next one of a recurring quest out, and what was unlocked by it. */
export async function completeQuest(questId: string): Promise<QuestResult> {
  const owner = await actionOwner()
  const db = await getDb()
  const [quest] = await db
    .select()
    .from(s.quest)
    .where(and(eq(s.quest.id, String(questId)), eq(s.quest.ownerId, owner.userId)))
  const before = levelFor(await totalXp(db, owner.userId))
  if (!quest || quest.status === 'done') return { ok: false, xp: 0, level: before.level, levelUp: null, badges: [] }
  const badgesBefore = new Set(earnedBadges(await badgeStats(db, owner.userId)))

  await db.update(s.quest).set({ status: 'done', doneAt: new Date() }).where(eq(s.quest.id, quest.id))
  const xp = await award(db, owner.userId, { kind: 'quest', refId: quest.id, projectId: quest.projectId, xp: quest.xp })
  const next = quest.dueOn ? nextDue(quest.dueOn, quest.recurrence as Recurrence) : null
  if (next) {
    await db
      .insert(s.quest)
      .values({
        id: crypto.randomUUID(),
        ownerId: owner.userId,
        projectId: quest.projectId,
        title: quest.title,
        detail: quest.detail,
        kind: quest.kind,
        xp: quest.xp,
        source: quest.source,
        sourceKey: `recur:${quest.id}`,
        recurrence: quest.recurrence,
        dueOn: next,
      })
      .onConflictDoNothing()
  }

  const after = levelFor(await totalXp(db, owner.userId))
  const unlocked = earnedBadges(await badgeStats(db, owner.userId)).filter((k) => !badgesBefore.has(k))
  refresh(quest.projectId)
  return {
    ok: true,
    xp,
    level: after.level,
    levelUp: after.level > before.level ? { level: after.level, title: after.title } : null,
    badges: BADGES.filter((b) => unlocked.includes(b.key)).map(({ key, title, description }) => ({ key, title, description })),
  }
}

export async function skipQuest(questId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [row] = await db
    .update(s.quest)
    .set({ status: 'skipped', doneAt: new Date() })
    .where(and(eq(s.quest.id, String(questId)), eq(s.quest.ownerId, owner.userId), eq(s.quest.status, 'open')))
    .returning({ projectId: s.quest.projectId })
  if (row) refresh(row.projectId)
}

/** Back to open, and the XP back out. */
export async function reopenQuest(questId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [row] = await db
    .update(s.quest)
    .set({ status: 'open', doneAt: null })
    .where(and(eq(s.quest.id, String(questId)), eq(s.quest.ownerId, owner.userId)))
    .returning({ projectId: s.quest.projectId })
  if (!row) return
  await revoke(db, owner.userId, 'quest', String(questId))
  refresh(row.projectId)
}

export async function deleteQuest(questId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [row] = await db
    .delete(s.quest)
    .where(and(eq(s.quest.id, String(questId)), eq(s.quest.ownerId, owner.userId)))
    .returning({ projectId: s.quest.projectId })
  if (row) refresh(row.projectId)
}

const questSchema = z.object({
  title: z.string().trim().min(2).max(160),
  detail: z.string().trim().max(1000),
  projectId: z.string().max(64),
  boss: z.boolean(),
  xp: z.coerce.number().refine((n) => (QUEST_XP as readonly number[]).includes(n)),
  dueOn: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  recurrence: z.enum(RECURRENCES),
})

/** A quest of his own: anything worth doing, from a VAT return to a launch. */
export async function saveQuest(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = questSchema.safeParse({
    title: form.get('title'),
    detail: form.get('detail') ?? '',
    projectId: form.get('projectId') ?? '',
    boss: form.get('boss') === 'on',
    xp: form.get('xp') ?? 25,
    dueOn: form.get('dueOn') ?? '',
    recurrence: form.get('recurrence') ?? 'none',
  })
  if (!parsed.success) return { ok: false, error: 'Geef de quest een titel van minstens twee tekens.' }
  const q = parsed.data
  if (q.recurrence !== 'none' && !q.dueOn) return { ok: false, error: 'Een terugkerende quest heeft een datum nodig.' }
  const db = await getDb()
  if (q.projectId) {
    const [project] = await db
      .select({ id: s.project.id })
      .from(s.project)
      .where(and(eq(s.project.id, q.projectId), eq(s.project.ownerId, owner.userId)))
    if (!project) return { ok: false, error: 'Dat project bestaat niet.' }
  }
  await db.insert(s.quest).values({
    id: crypto.randomUUID(),
    ownerId: owner.userId,
    projectId: q.projectId || null,
    title: q.title,
    detail: q.detail,
    kind: q.boss ? 'boss' : 'custom',
    xp: q.boss ? BOSS_XP : q.xp,
    source: 'manual',
    recurrence: q.recurrence,
    dueOn: q.dueOn || null,
  })
  refresh(q.projectId || null)
  return { ok: true, message: 'Quest staat erop.' }
}
