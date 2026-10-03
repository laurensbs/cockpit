import 'server-only'
import { and, count, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { XP_RULES, type XpKind } from '@/lib/game'

/**
 * Adds XP to the ledger, once per (kind, refId) and within the daily cap of its kind. Returns the
 * XP actually given (0 when it was already given or the cap is reached). `day` is the day it
 * counts for, which for a commit day is the day of the commits.
 */
export async function award(
  db: Db,
  ownerId: string,
  input: { kind: XpKind; refId: string; projectId?: string | null; xp?: number; day?: string },
): Promise<number> {
  const rule = XP_RULES[input.kind]
  const xp = Math.round(input.xp ?? rule.xp)
  if (xp <= 0) return 0
  const day = input.day ?? dayOf(new Date())
  if (Number.isFinite(rule.dailyCap)) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(s.xpEvent)
      .where(and(eq(s.xpEvent.ownerId, ownerId), eq(s.xpEvent.kind, input.kind), eq(s.xpEvent.day, day)))
    if (n >= rule.dailyCap) return 0
  }
  const rows = await db
    .insert(s.xpEvent)
    .values({ id: crypto.randomUUID(), ownerId, projectId: input.projectId ?? null, kind: input.kind, refId: input.refId, xp, day })
    .onConflictDoNothing()
    .returning({ id: s.xpEvent.id })
  return rows.length ? xp : 0
}

/** Takes XP back (a quest reopened, a post unmarked). */
export async function revoke(db: Db, ownerId: string, kind: XpKind, refId: string): Promise<void> {
  await db.delete(s.xpEvent).where(and(eq(s.xpEvent.ownerId, ownerId), eq(s.xpEvent.kind, kind), eq(s.xpEvent.refId, refId)))
}

export async function totalXp(db: Db, ownerId: string): Promise<number> {
  const rows = await db.select({ xp: s.xpEvent.xp }).from(s.xpEvent).where(eq(s.xpEvent.ownerId, ownerId))
  return rows.reduce((sum, r) => sum + r.xp, 0)
}
