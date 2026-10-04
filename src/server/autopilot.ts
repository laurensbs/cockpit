import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf, hourOf, weekdayOf, weekStart } from '@/lib/dates'
import { launchPrompt, runHeadless } from './claude'
import { createTicket } from './mcp/tickets'
import { getSetting, setSetting } from './settings'

/**
 * Opt-in: on Monday morning Claude Code makes the weekly focus by itself, in the background, once a
 * week. It runs on his own Claude account, like everything else.
 */
export async function maybeAutopilot(db: Db, ownerId: string, now = new Date()): Promise<'off' | 'not-now' | 'done-already' | 'started' | 'failed'> {
  if ((await getSetting(db, ownerId, 'autopilot_weekly')) !== '1') return 'off'
  const today = dayOf(now)
  if (weekdayOf(today) !== 1 || hourOf(now) < 7) return 'not-now'
  const week = weekStart(today)
  if ((await getSetting(db, ownerId, 'autopilot_week')) === week) return 'done-already'
  const [latest] = await db
    .select({ createdAt: s.brief.createdAt })
    .from(s.brief)
    .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'weekly'), isNull(s.brief.projectId)))
    .orderBy(desc(s.brief.createdAt))
    .limit(1)
  if (latest && dayOf(latest.createdAt) >= week) {
    await setSetting(db, ownerId, 'autopilot_week', week)
    return 'done-already'
  }
  const ticket = createTicket({ task: 'weekly', projectId: null, options: {} })
  const { started } = await runHeadless(launchPrompt(ticket))
  if (started) await setSetting(db, ownerId, 'autopilot_week', week)
  return started ? 'started' : 'failed'
}
