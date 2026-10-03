import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { dayOf, weekdayOf } from '@/lib/dates'
import { isOwnerEmail } from '@/lib/owner'
import { ownerEmails } from '@/lib/site'
import { reserveRun } from '@/server/ai/budget'
import { MODEL } from '@/server/ai/client'
import { JOBS } from '@/server/ai/jobs'
import { contextFor, estimate, executeRun } from '@/server/ai/run'
import { sendWeeklyDigest } from '@/server/digest'
import { dailyRound } from '@/server/game'
import { syncAll } from '@/server/github/sync'
import { aiStatus } from '@/server/status'
import { checkSites } from '@/server/uptime'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Vercel Cron sends "Authorization: Bearer CRON_SECRET". Without a secret the job does not run at all. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * Once a day: read GitHub again, check the sites, make the rule quests and give the commit XP.
 * On Mondays also the weekly focus (only with WEEKLY_AI=1, within the AI budget) and the mail.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = await getDb()
  const owners = (await db.select({ id: s.user.id, email: s.user.email, name: s.user.name }).from(s.user)).filter((u) => isOwnerEmail(u.email, ownerEmails()))
  const monday = weekdayOf(dayOf(new Date())) === 1
  const report: Record<string, unknown>[] = []
  for (const owner of owners) {
    const github = await syncAll(db, owner.id, 120_000)
    const sites = await checkSites(db, owner.id)
    await dailyRound(db, owner.id)
    let weekly = 'skipped'
    let mailed = false
    if (monday) {
      if (process.env.WEEKLY_AI === '1' && aiStatus() !== 'off') {
        const ctx = await contextFor(db, JOBS.weekly, owner.id, null)
        const reserved = ctx ? await reserveRun(db, { ownerId: owner.id, projectId: null, kind: 'weekly', model: MODEL, worstMicros: estimate(JOBS.weekly, ctx).worstMicros, options: {} }) : null
        if (reserved && 'runId' in reserved) {
          await executeRun(reserved.runId)
          weekly = 'made'
        } else weekly = reserved ? reserved.refusal : 'no-context'
      }
      mailed = await sendWeeklyDigest(db, { userId: owner.id, email: owner.email, name: owner.name })
    }
    report.push({ github, sites, weekly, mailed })
  }
  return NextResponse.json({ ok: true, owners: owners.length, report })
}
