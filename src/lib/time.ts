import { dayLabel, dayOf, daysBetween } from './dates'

/** "zojuist", "12 min geleden", "3 uur geleden", "gisteren", "4 dagen geleden", or a date. */
export function ago(date: Date, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return 'zojuist'
  if (minutes < 60) return `${minutes} min geleden`
  const days = daysBetween(dayOf(date), dayOf(now))
  if (days === 0) return `${Math.floor(minutes / 60)} uur geleden`
  if (days === 1) return 'gisteren'
  if (days < 14) return `${days} dagen geleden`
  return dayLabel(dayOf(date))
}

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const plain = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 })
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatEuro = (n: number) => euro.format(n)
export const formatNumber = (n: number) => plain.format(n)
/** Millionths of a dollar as "$0.24". */
export const formatUsdMicros = (micros: number) => dollars.format(micros / 1_000_000)
