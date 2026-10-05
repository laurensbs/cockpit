import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import { dayOf } from '@/lib/dates'
import { reminderDue, reminderText, reminderTime } from '@/lib/reminder'
import { bearerOwner, getOwner } from '@/server/session'
import { getSetting, setSetting } from '@/server/settings'
import { dayProgress, daySteps } from '@/server/today'

export const dynamic = 'force-dynamic'

/**
 * Asked by the app every minute: is it time for today's nudge? At most once a day, only on a working day
 * from his chosen time, and only while his day goal is still open. Saying yes marks today as done.
 */
export async function POST(request: Request) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = await getDb()
  const now = new Date()
  const [time, lastDay, sound] = await Promise.all([getSetting(db, owner.userId, 'reminder_time'), getSetting(db, owner.userId, 'reminder_day'), getSetting(db, owner.userId, 'reminder_sound')])
  const progress = await dayProgress(db, owner.userId)
  if (!reminderDue({ now, time: reminderTime(time), lastDay, reached: progress.done >= progress.goal })) return NextResponse.json({ show: false })
  const steps = await daySteps(db, owner.userId, 3)
  await setSetting(db, owner.userId, 'reminder_day', dayOf(now))
  return NextResponse.json({ show: true, ...reminderText(Math.max(1, Math.min(steps.length || progress.goal, progress.goal - progress.done)), steps[0]?.title ?? null), sound: sound === '1' })
}
