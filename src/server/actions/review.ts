'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { type Review, reviewFromJson } from '@/lib/ai/schemas'
import { addDays, dayOf, weekStart } from '@/lib/dates'
import type { GrowthModel } from '@/lib/growth-model'
import { startingPoint } from '../points'
import { actionOwner } from '../session'

// What he takes over from the weekly review: a decision becomes a quest, a lesson goes into every
// next brief, a target change becomes the project's new target. Claude never does this itself.

async function ownReview(briefId: string) {
  const owner = await actionOwner()
  const db = await getDb()
  const [brief] = await db
    .select()
    .from(s.brief)
    .where(and(eq(s.brief.id, String(briefId)), eq(s.brief.ownerId, owner.userId), eq(s.brief.kind, 'review')))
  const review = brief ? reviewFromJson(brief.content) : null
  return brief && review ? { db, owner, brief, review } : null
}

async function projectNamed(db: Awaited<ReturnType<typeof getDb>>, ownerId: string, name: string) {
  const projects = await db.select({ id: s.project.id, name: s.project.name, model: s.project.growthModel }).from(s.project).where(eq(s.project.ownerId, ownerId))
  return projects.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null
}

const refresh = () => {
  revalidatePath('/')
  revalidatePath('/quests')
}

const DECISION_WORDS: Record<Review['decisions'][number]['kind'], string> = { stop: 'Stop', continue: 'Ga door', start: 'Begin' }

/** "Maak quest": a decision for next week on his list, on the project it names. */
export async function reviewQuest(briefId: string, index: number): Promise<{ ok: boolean }> {
  const own = await ownReview(briefId)
  const decision = own?.review.decisions[Number(index)]
  if (!own || !decision) return { ok: false }
  const project = await projectNamed(own.db, own.owner.userId, decision.project)
  const title = decision.kind === 'stop' && !/^stop/i.test(decision.what) ? `${DECISION_WORDS.stop}: ${decision.what}` : decision.what
  await own.db
    .insert(s.quest)
    .values({
      id: crypto.randomUUID(),
      ownerId: own.owner.userId,
      projectId: project?.id ?? null,
      title: title.slice(0, 120),
      detail: decision.why,
      kind: 'custom',
      xp: 25,
      source: 'ai',
      sourceKey: `review:${own.brief.id}:${Number(index)}`,
      dueOn: addDays(weekStart(dayOf(new Date())), 6),
    })
    .onConflictDoNothing()
  refresh()
  return { ok: true }
}

/** "Bewaar als les": from now on in every brief to Claude, like the lessons from experiments. */
export async function keepReviewLesson(briefId: string, index: number): Promise<{ ok: boolean }> {
  const own = await ownReview(briefId)
  const lesson = own?.review.lessons[Number(index)]
  if (!own || !lesson) return { ok: false }
  const project = await projectNamed(own.db, own.owner.userId, lesson.project)
  const refId = `${own.brief.id}:${Number(index)}`
  const existing = await own.db
    .select({ body: s.contentItem.body })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.ownerId, own.owner.userId), eq(s.contentItem.kind, 'lesson'), eq(s.contentItem.channel, 'review')))
  if (!existing.some((e) => (e.body as { refId?: string }).refId === refId)) {
    await own.db.insert(s.contentItem).values({
      id: crypto.randomUUID(),
      ownerId: own.owner.userId,
      projectId: project?.id ?? null,
      kind: 'lesson',
      channel: 'review',
      title: `Weekreview van ${dayOf(own.brief.createdAt)}`,
      status: 'done',
      doneAt: new Date(),
      body: { source: 'review', refId, learning: lesson.lesson },
    })
  }
  refresh()
  if (project) revalidatePath(`/projects/${project.id}/numbers`)
  return { ok: true }
}

/** "Overnemen": the same target number with the new target and deadline, measured from today. */
export async function applyTargetChange(briefId: string, index: number): Promise<{ ok: boolean; message: string }> {
  const own = await ownReview(briefId)
  const change = own?.review.targetChanges[Number(index)]
  if (!own || !change) return { ok: false, message: 'Dit voorstel bestaat niet meer.' }
  const project = await projectNamed(own.db, own.owner.userId, change.project)
  const model = project?.model as GrowthModel | null | undefined
  if (!project || !model) return { ok: false, message: 'Dit project heeft nog geen doel om aan te passen.' }
  const today = dayOf(new Date())
  if (change.deadline < addDays(today, 14) || change.deadline > addDays(today, 365)) return { ok: false, message: 'De deadline ligt niet tussen twee weken en een jaar vanaf vandaag.' }
  const next: GrowthModel = {
    ...model,
    northStar: {
      ...model.northStar,
      target: change.target,
      deadline: change.deadline,
      baseline: await startingPoint(own.db, own.owner.userId, project.id, model.northStar.key, today),
      startedOn: today,
    },
  }
  await own.db.update(s.project).set({ growthModel: next, updatedAt: new Date() }).where(eq(s.project.id, project.id))
  refresh()
  revalidatePath(`/projects/${project.id}`)
  revalidatePath(`/projects/${project.id}/numbers`)
  return { ok: true, message: 'Overgenomen.' }
}
