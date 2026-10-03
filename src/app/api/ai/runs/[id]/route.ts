import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { sweepStaleRuns } from '@/server/ai/budget'
import { getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/** The state of one AI run, polled by the page while it works. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await params
  const db = await getDb()
  await sweepStaleRuns(db, owner.userId)
  const [run] = await db
    .select({ status: s.aiRun.status, error: s.aiRun.error, costMicros: s.aiRun.costMicros, startedAt: s.aiRun.startedAt })
    .from(s.aiRun)
    .where(and(eq(s.aiRun.id, id), eq(s.aiRun.ownerId, owner.userId)))
  if (!run) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  return NextResponse.json(run, { headers: { 'Cache-Control': 'no-store' } })
}
