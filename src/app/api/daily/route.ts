import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { maybeAutopilot, maybeBuildPosts, maybePlanWeek, maybeProspect } from '@/server/autopilot'
import { claudeLoggedIn } from '@/server/claude'
import { healClaudeConnection } from '@/server/claude-heal'
import { pullAll } from '@/server/connectors/run'
import { dailyRound } from '@/server/game'
import { syncAll } from '@/server/github/sync'
import { bearerOwner, getOwner } from '@/server/session'
import { maybeRefresh } from '@/server/knowledge'
import { checkSetup } from '@/server/setup-check'
import { checkSites } from '@/server/uptime'

export const dynamic = 'force-dynamic'

/**
 * The daily round: keep Claude Code connected, read GitHub again, check the sites, pull the numbers
 * from the connected sources, make the rule quests and give the commit XP.
 * The app calls it when it starts and every twelve hours; the settings page has a button for it.
 */
export async function POST(request: Request) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = await getDb()
  const claude = await healClaudeConnection(db, owner.userId)
  const github = await syncAll(db, owner.userId, 120_000)
  const sites = await checkSites(db, owner.userId)
  const numbers = await pullAll(db, owner.userId)
  const setup = await checkSetup(db, owner.userId).catch(() => 0)
  await dailyRound(db, owner.userId)
  // Logged out: start nothing, so today's work is still there once he logs in ("probeer opnieuw").
  if ((await claudeLoggedIn()) === false) return NextResponse.json({ ok: true, claude, github, sites, numbers: { pulled: numbers.pulled, failed: numbers.failed }, setup, background: 'logged-out' })
  const autopilot = await maybeAutopilot(db, owner.userId)
  const prospects = await maybeProspect(db, owner.userId)
  const posts = await maybeBuildPosts(db, owner.userId)
  const planned = await maybePlanWeek(db, owner.userId)
  const refreshed = await maybeRefresh(db, owner.userId)
  return NextResponse.json({ ok: true, claude, github, sites, numbers: { pulled: numbers.pulled, failed: numbers.failed }, setup, autopilot, prospects, posts, planned, refreshed })
}
