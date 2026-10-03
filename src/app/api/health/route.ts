import { NextResponse } from 'next/server'
import { dbMode, ready } from '@/db'
import { aiStatus, emailStatus, githubStatus } from '@/server/status'

export const dynamic = 'force-dynamic'

/** Whether the parts are connected, never which keys: safe to call without signing in. */
export async function GET() {
  await ready()
  return NextResponse.json({
    ok: true,
    database: dbMode(),
    ai: aiStatus(),
    github: githubStatus(),
    email: emailStatus(),
    region: process.env.VERCEL_REGION ?? null,
  })
}
