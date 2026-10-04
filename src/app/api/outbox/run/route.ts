import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { runOutbox } from '@/server/outbox'
import { bearerOwner, getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/** Sends what is due now (the server also does this every two minutes on its own). */
export async function POST(request: Request) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true, ...(await runOutbox(await getDb(), owner.userId)) })
}
