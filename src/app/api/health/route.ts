import { NextResponse } from 'next/server'
import { dbMode, getDb } from '@/db'
import { LOCAL_OWNER_ID } from '@/server/session'
import { githubToken } from '@/server/settings'
import { githubStatus } from '@/server/status'

export const dynamic = 'force-dynamic'

/** Whether the parts are there, never which keys. The app waits for this before it opens its window. */
export async function GET() {
  const db = await getDb()
  return NextResponse.json({
    ok: true,
    database: dbMode(),
    github: githubStatus(await githubToken(db, LOCAL_OWNER_ID)),
    version: process.env.COCKPIT_VERSION ?? 'dev',
  })
}
