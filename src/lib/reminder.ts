// The daily reminder, like a language app's: one nudge on a working day, at the time he chose, only
// while his day goal is still open, never twice a day. Pure, so the rule can be tested; the app asks
// /api/reminder every minute and shows the notification.

import { dayOf, TIME_ZONE, weekdayOf } from './dates'

export const DEFAULT_REMINDER = '09:00'

const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "09:05": the time of day in Amsterdam. */
export function clockOf(date: Date): string {
  return clockFormat.format(date)
}

/** The stored time, or the default; '' means he switched it off. A malformed value counts as off. */
export function reminderTime(stored: string | null): string {
  if (stored === null) return DEFAULT_REMINDER
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(stored) ? stored : ''
}

export function reminderDue(input: { now: Date; time: string; lastDay: string | null; reached: boolean }): boolean {
  if (!input.time || input.reached) return false
  const today = dayOf(input.now)
  if (input.lastDay === today || weekdayOf(today) > 5) return false
  return clockOf(input.now) >= input.time
}

/** What the notification says: how much is left, and the first step by name. */
export function reminderText(left: number, first: string | null): { title: string; body: string } {
  return {
    title: 'Je dag staat klaar',
    body: `${left} ${left === 1 ? 'stap' : 'stappen'} · een paar minuten${first ? `. Eerst: ${first}` : ''}`,
  }
}
