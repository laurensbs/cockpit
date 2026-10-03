import 'server-only'
import { and, eq, isNotNull } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'

/** Checks once a day whether each project's site answers; 0 means it did not answer at all. */
export async function checkSites(db: Db, ownerId: string): Promise<{ checked: number; down: number }> {
  const projects = await db
    .select({ id: s.project.id, siteUrl: s.project.siteUrl })
    .from(s.project)
    .where(and(eq(s.project.ownerId, ownerId), isNotNull(s.project.siteUrl)))
  let down = 0
  for (const p of projects) {
    let status = 0
    try {
      const res = await fetch(p.siteUrl!, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'cockpit-uptime' }, cache: 'no-store' })
      status = res.status
    } catch {
      status = 0
    }
    if (status === 0 || status >= 500) down++
    await db.update(s.project).set({ siteStatus: status, siteCheckedAt: new Date() }).where(eq(s.project.id, p.id))
  }
  return { checked: projects.length, down }
}
