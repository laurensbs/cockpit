'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb, type Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayOf } from '@/lib/dates'
import { type GrowthModel, normalizeModel } from '@/lib/growth-model'
import { METRIC_DEFS } from '@/lib/metrics'
import { currentValue } from '@/lib/pace'
import { dailySeries, loadPoints } from '../points'
import { actionOwner } from '../session'
import { award } from '../xp'
import type { FormState } from './types'

/** Where the line to the target starts: the value now (the latest level, or a flow's last 30 days). */
async function startingPoint(db: Db, ownerId: string, projectId: string, key: GrowthModel['northStar']['key'], today: string) {
  const rows = await loadPoints(db, ownerId, addDays(today, -60), { projectIds: [projectId], keys: [key] })
  return currentValue(METRIC_DEFS[key], dailySeries(rows, projectId, key), today)
}

const refresh = (projectId: string) => {
  revalidatePath(`/projects/${projectId}/numbers`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

/** The model from the form: one target with a deadline, up to five stages. He sets it; Claude only proposes. */
export async function saveModel(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const projectId = String(form.get('projectId') ?? '')
  const funnel = [0, 1, 2, 3, 4]
    .map((i) => ({ key: String(form.get(`stage${i}`) ?? ''), label: String(form.get(`label${i}`) ?? ''), rate: String(form.get(`rate${i}`) ?? '').trim() || null }))
    .filter((st) => st.key)
  const today = dayOf(new Date())
  const result = normalizeModel(
    {
      northStar: { key: String(form.get('key') ?? ''), target: String(form.get('target') ?? ''), deadline: String(form.get('deadline') ?? '') },
      // The form asks for percentages.
      funnel: funnel.map((st) => ({ ...st, rate: st.rate == null ? null : Number(st.rate.replace(',', '.')) / 100 })),
      valuePerDeal: String(form.get('valuePerDeal') ?? '').trim() || null,
      note: String(form.get('note') ?? ''),
    },
    today,
  )
  if ('error' in result) return { ok: false, error: result.error }
  const db = await getDb()
  const [project] = await db
    .select({ id: s.project.id, model: s.project.growthModel })
    .from(s.project)
    .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, owner.userId)))
  if (!project) return { ok: false, error: 'Dat project bestaat niet.' }
  const model = result.model
  // The same target number keeps its starting point; a new one starts from today.
  const previous = project.model
  if (previous && previous.northStar.key === model.northStar.key) {
    model.northStar.baseline = previous.northStar.baseline
    model.northStar.startedOn = previous.northStar.startedOn
    model.fromBrief = previous.fromBrief ?? null
  } else {
    model.northStar.baseline = await startingPoint(db, owner.userId, projectId, model.northStar.key, today)
    model.northStar.startedOn = today
  }
  await db.update(s.project).set({ growthModel: model, updatedAt: new Date() }).where(eq(s.project.id, projectId))
  refresh(projectId)
  return { ok: true, message: 'Groeimodel bewaard.' }
}

/** Takes Claude's proposal as the model, starting from today's value. */
export async function acceptModel(briefId: string): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const db = await getDb()
  const [brief] = await db
    .select({ id: s.brief.id, projectId: s.brief.projectId, content: s.brief.content })
    .from(s.brief)
    .where(and(eq(s.brief.id, String(briefId)), eq(s.brief.ownerId, owner.userId), eq(s.brief.kind, 'model')))
  if (!brief?.projectId) return { ok: false, message: 'Dit voorstel bestaat niet meer.' }
  const today = dayOf(new Date())
  const proposed = brief.content as GrowthModel
  const model: GrowthModel = {
    ...proposed,
    northStar: { ...proposed.northStar, baseline: await startingPoint(db, owner.userId, brief.projectId, proposed.northStar.key, today), startedOn: today },
    fromBrief: brief.id,
  }
  await db
    .update(s.project)
    .set({ growthModel: model, updatedAt: new Date() })
    .where(and(eq(s.project.id, brief.projectId), eq(s.project.ownerId, owner.userId)))
  const xp = await award(db, owner.userId, { kind: 'plan', refId: `model:${brief.id}`, projectId: brief.projectId })
  refresh(brief.projectId)
  return { ok: true, message: xp ? `Overgenomen. +${xp} XP` : 'Overgenomen.' }
}

/** Throws a proposal away. */
export async function dismissModel(briefId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [brief] = await db
    .delete(s.brief)
    .where(and(eq(s.brief.id, String(briefId)), eq(s.brief.ownerId, owner.userId), eq(s.brief.kind, 'model')))
    .returning({ projectId: s.brief.projectId })
  if (brief?.projectId) refresh(brief.projectId)
}
