import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { keepAwakeOn, reportAwake } from '@/server/keep-awake'
import { bearerOwner, getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

const STATUSES = new Set(['awake', 'battery', 'off'])

/**
 * The app window asks whether to keep the computer awake, and tells what it does now
 * ({ status: 'awake' | 'battery' | 'off' }). Only with the app's token.
 */
export async function POST(request: Request) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { status?: unknown }
  if (typeof body.status === 'string' && STATUSES.has(body.status)) reportAwake(body.status as 'awake' | 'battery' | 'off')
  return NextResponse.json({ on: await keepAwakeOn(await getDb(), owner.userId) })
}
