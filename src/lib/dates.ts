// Days are Amsterdam days: a streak or a daily quest follows the owner's own clock, not UTC.

export const TIME_ZONE = 'Europe/Amsterdam'

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' })

/** 'YYYY-MM-DD' of the given moment in Amsterdam. */
export function dayOf(date: Date): string {
  return dayFormat.format(date)
}

export function hourOf(date: Date): number {
  return Number(hourFormat.format(date))
}

/** Adds whole days to a 'YYYY-MM-DD' day (calendar arithmetic, no time zones involved). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

/** Whole days from a to b ('YYYY-MM-DD'); positive when b is later. */
export function daysBetween(a: string, b: string): number {
  const toUtc = (day: string) => {
    const [y, m, d] = day.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

/** Monday of the ISO week that contains the day. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
  return addDays(day, 1 - weekday)
}

/** 1 = Monday … 7 = Sunday. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7
}

/** 'YYYY-MM-01' of the month that contains the day. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`
}

/** 'YYYY-MM-01' of the month n months later (negative for earlier). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  return t.toISOString().slice(0, 10)
}

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const WEEKDAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

export function dayLabel(day: string): string {
  return `${WEEKDAYS[weekdayOf(day) - 1]} ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`
}

export function greeting(date: Date): string {
  const h = hourOf(date)
  if (h < 6) return 'Goedenacht'
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}
