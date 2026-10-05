import { eq, max } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { bearerOwner, getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/** When something was last added (a brief, a draft, a quest, a contact): the page polls this after it opened Claude Code. */
export async function GET(request: Request) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = await getDb()
  const [[b], [c], [q], [k]] = await Promise.all([
    db.select({ at: max(s.brief.createdAt) }).from(s.brief).where(eq(s.brief.ownerId, owner.userId)),
    db.select({ at: max(s.contentItem.createdAt) }).from(s.contentItem).where(eq(s.contentItem.ownerId, owner.userId)),
    db.select({ at: max(s.quest.createdAt) }).from(s.quest).where(eq(s.quest.ownerId, owner.userId)),
    db.select({ at: max(s.contact.createdAt) }).from(s.contact).where(eq(s.contact.ownerId, owner.userId)),
  ])
  const latest = [b?.at, c?.at, q?.at, k?.at].filter((d): d is Date => d instanceof Date).sort((x, y) => y.getTime() - x.getTime())[0] ?? null
  return NextResponse.json({ latest: latest ? latest.toISOString() : null }, { headers: { 'Cache-Control': 'no-store' } })
}
