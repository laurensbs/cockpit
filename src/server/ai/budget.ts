import 'server-only'
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { monthlyBudgetUsd } from '../status'

/** Runs that are "running" for longer than this died with their function; they free their reservation. */
export const STALE_MS = 330_000

export interface BudgetState {
  budgetMicros: number
  spentMicros: number
  reservedMicros: number
  remainingMicros: number
  todayMicros: number
  dailyCapMicros: number
}

const monthStartUtc = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
const dayStartUtc = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

/** Marks dead runs as failed, so their reservation does not block the budget forever. */
export async function sweepStaleRuns(db: Db, ownerId: string, now = new Date()): Promise<void> {
  await db
    .update(s.aiRun)
    .set({ status: 'error', error: 'Geen antwoord binnen de tijd.', reservedMicros: 0, finishedAt: now })
    .where(and(eq(s.aiRun.ownerId, ownerId), eq(s.aiRun.status, 'running'), lt(s.aiRun.startedAt, new Date(now.getTime() - STALE_MS))))
}

/** This month's spending (UTC month, like Anthropic's invoice) and what running calls hold back. */
export async function budgetState(db: Db, ownerId: string, now = new Date()): Promise<BudgetState> {
  const [month] = await db
    .select({
      spent: sql<number>`coalesce(sum(${s.aiRun.costMicros}), 0)`.mapWith(Number),
      reserved: sql<number>`coalesce(sum(case when ${s.aiRun.status} = 'running' then ${s.aiRun.reservedMicros} else 0 end), 0)`.mapWith(Number),
    })
    .from(s.aiRun)
    .where(and(eq(s.aiRun.ownerId, ownerId), gte(s.aiRun.startedAt, monthStartUtc(now))))
  const [day] = await db
    .select({ spent: sql<number>`coalesce(sum(${s.aiRun.costMicros} + case when ${s.aiRun.status} = 'running' then ${s.aiRun.reservedMicros} else 0 end), 0)`.mapWith(Number) })
    .from(s.aiRun)
    .where(and(eq(s.aiRun.ownerId, ownerId), gte(s.aiRun.startedAt, dayStartUtc(now))))
  const budgetMicros = Math.round(monthlyBudgetUsd() * 1_000_000)
  return {
    budgetMicros,
    spentMicros: month.spent,
    reservedMicros: month.reserved,
    remainingMicros: Math.max(0, budgetMicros - month.spent - month.reserved),
    todayMicros: day.spent,
    dailyCapMicros: Math.round(budgetMicros / 5),
  }
}

export type Refusal = 'budget' | 'daily' | 'busy'

/**
 * Reserves the worst case of a new run and creates it, or says why not. Under a lock per owner, so
 * two clicks at once cannot both squeeze through the last dollar.
 */
export async function reserveRun(
  db: Db,
  input: { ownerId: string; projectId: string | null; kind: string; model: string; worstMicros: number; options: Record<string, unknown> },
): Promise<{ runId: string } | { refusal: Refusal }> {
  await sweepStaleRuns(db, input.ownerId)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai:${input.ownerId}`}))`)
    const txDb = tx as unknown as Db
    const busy = await txDb
      .select({ id: s.aiRun.id })
      .from(s.aiRun)
      .where(
        and(
          eq(s.aiRun.ownerId, input.ownerId),
          eq(s.aiRun.status, 'running'),
          eq(s.aiRun.kind, input.kind),
          input.projectId ? eq(s.aiRun.projectId, input.projectId) : sql`${s.aiRun.projectId} is null`,
        ),
      )
    if (busy.length) return { refusal: 'busy' as const }
    const state = await budgetState(txDb, input.ownerId)
    if (state.remainingMicros < input.worstMicros) return { refusal: 'budget' as const }
    if (state.todayMicros + input.worstMicros > state.dailyCapMicros) return { refusal: 'daily' as const }
    const runId = crypto.randomUUID()
    await txDb.insert(s.aiRun).values({
      id: runId,
      ownerId: input.ownerId,
      projectId: input.projectId,
      kind: input.kind,
      options: input.options,
      status: 'running',
      model: input.model,
      reservedMicros: input.worstMicros,
    })
    return { runId }
  })
}
