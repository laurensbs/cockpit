import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { runPublisher } from '@/server/publish/run'
import { bearerOwner, getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/** One due post goes out (the worker calls this every two minutes; the tests call it directly). */
export async function POST(request: Request) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await runPublisher(await getDb(), owner.userId))
}
