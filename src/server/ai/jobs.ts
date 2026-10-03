import 'server-only'
import type { z } from 'zod'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { planFixture, profileFixture } from '@/lib/ai/fixtures'
import { planTask, profileTask } from '@/lib/ai/prompts'
import { normalizePlan, normalizeProfile, PlanWire, ProfileWire } from '@/lib/ai/schemas'
import { award } from '../xp'
import type { JobContext } from './context'

export interface Job<W extends z.ZodType = z.ZodType> {
  label: string
  wire: W
  effort: 'low' | 'medium' | 'high'
  maxTokens: number
  /** What usually comes back, for the estimate on the button (the budget reserves the worst case). */
  typicalOutput: number
  task: (ctx: JobContext) => string
  fixture: (ctx: JobContext) => z.infer<W>
  save: (db: Db, run: { id: string; ownerId: string; projectId: string | null }, ctx: JobContext, wire: z.infer<W>) => Promise<void>
}

const profile: Job<typeof ProfileWire> = {
  label: 'Marketingprofiel',
  wire: ProfileWire,
  effort: 'medium',
  maxTokens: 12_000,
  typicalOutput: 4_000,
  task: (ctx) => profileTask(ctx.project.name),
  fixture: (ctx) => profileFixture(ctx.project.name),
  async save(db, run, ctx, wire) {
    await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId: run.ownerId, projectId: ctx.project.id, kind: 'profile', content: normalizeProfile(wire), runId: run.id })
  },
}

const plan: Job<typeof PlanWire> = {
  label: 'Plan voor 90 dagen',
  wire: PlanWire,
  effort: 'medium',
  maxTokens: 14_000,
  typicalOutput: 5_000,
  task: (ctx) => planTask(ctx.project.name, ctx.profile),
  fixture: () => planFixture(),
  async save(db, run, ctx, wire) {
    const id = crypto.randomUUID()
    await db.insert(s.brief).values({ id, ownerId: run.ownerId, projectId: ctx.project.id, kind: 'plan', content: normalizePlan(wire), runId: run.id })
    await award(db, run.ownerId, { kind: 'plan', refId: id, projectId: ctx.project.id })
  },
}

export const JOBS = { profile, plan } as const
export type JobKind = keyof typeof JOBS
export const isJobKind = (v: unknown): v is JobKind => typeof v === 'string' && v in JOBS
