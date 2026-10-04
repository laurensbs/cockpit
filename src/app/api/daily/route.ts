import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { maybeAutopilot } from '@/server/autopilot'
import { dailyRound } from '@/server/game'
import { syncAll } from '@/server/github/sync'
import { bearerOwner, getOwner } from '@/server/session'
import { checkSites } from '@/server/uptime'

export const dynamic = 'force-dynamic'

/**
 * The daily round: read GitHub again, check the sites, make the rule quests and give the commit XP.
 * The app calls it when it starts and every twelve hours; the settings page has a button for it.
 */
export async function POST(request: Request) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = await getDb()
  const github = await syncAll(db, owner.userId, 120_000)
  const sites = await checkSites(db, owner.userId)
  await dailyRound(db, owner.userId)
  const autopilot = await maybeAutopilot(db, owner.userId)
  return NextResponse.json({ ok: true, github, sites, autopilot })
}
