import { PGlite } from '@electric-sql/pglite'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import migrations from '@/db/migrations.json'
import * as s from '@/db/schema'
import { budgetState, reserveRun, sweepStaleRuns } from './budget'

vi.mock('server-only', () => ({}))

const client = new PGlite()
const db = drizzle({ client, schema: s })
const OWNER = 'u1'

beforeAll(async () => {
  for (const m of migrations) for (const statement of m.statements) await client.exec(statement)
  await client.exec(`insert into "user" (id, name, email, email_verified, created_at, updated_at) values ('${OWNER}', 'L', 'l@example.org', true, now(), now())`)
  process.env.AI_MONTHLY_BUDGET_USD = '1'
})
afterAll(() => client.close())

const reserve = (kind: string, worstMicros: number, projectId: string | null = null) =>
  reserveRun(db as never, { ownerId: OWNER, projectId, kind, model: 'claude-opus-5-5', worstMicros, options: {} })

describe('the AI budget guard', () => {
  it('reserves the worst case, refuses a second run of the same job, and keeps to the daily cap', async () => {
    const first = await reserve('profile', 150_000)
    expect(first).toHaveProperty('runId')
    expect(await reserve('profile', 10_000)).toEqual({ refusal: 'busy' })
    // A fifth of $1 per day: 150k held + 100k would be over 200k.
    expect(await reserve('plan', 100_000)).toEqual({ refusal: 'daily' })
    // The first run turns out cheaper: its reservation goes, its real cost stays.
    await db
      .update(s.aiRun)
      .set({ status: 'done', costMicros: 50_000, reservedMicros: 0 })
      .where(eq(s.aiRun.id, (first as { runId: string }).runId))
    expect(await reserve('plan', 140_000)).toHaveProperty('runId')
    const state = await budgetState(db as never, OWNER)
    expect(state).toMatchObject({ budgetMicros: 1_000_000, spentMicros: 50_000, reservedMicros: 140_000, remainingMicros: 810_000, dailyCapMicros: 200_000 })
  })

  it('refuses when the month is spent', async () => {
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1, 0, 1))
    await db.insert(s.aiRun).values({ id: 'old', ownerId: OWNER, kind: 'plan', model: 'claude-opus-5-5', status: 'done', costMicros: 900_000, startedAt: monthStart })
    expect(await reserve('ideas', 100_000)).toEqual({ refusal: 'budget' })
  })

  it('frees the reservation of a run that died with its function', async () => {
    await db.insert(s.aiRun).values({ id: 'dead', ownerId: OWNER, kind: 'posts', model: 'claude-opus-5-5', status: 'running', reservedMicros: 500_000, startedAt: new Date(Date.now() - 10 * 60_000) })
    await sweepStaleRuns(db as never, OWNER)
    const [dead] = await db.select().from(s.aiRun).where(eq(s.aiRun.id, 'dead'))
    expect(dead).toMatchObject({ status: 'error', reservedMicros: 0 })
  })
})
