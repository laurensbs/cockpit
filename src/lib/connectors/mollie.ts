// Mollie, read-only: revenue per Amsterdam day from paid payments (minus refunds), and MRR plus the
// number of customers from active subscriptions. Only euros. Pure: the server fetches, these read.

import { dayOf } from '../dates'

export interface MollieAmount {
  value: string
  currency: string
}

export interface MolliePayment {
  status: string
  amount: MollieAmount
  amountRefunded?: MollieAmount | null
  paidAt?: string | null
  createdAt: string
}

export interface MollieSubscription {
  status: string
  amount: MollieAmount
  interval: string
  customerId?: string
}

/** Revenue per day (euros), and how many payments in another currency were left out. */
export function mollieRevenueByDay(payments: MolliePayment[]): { points: { day: string; value: number }[]; skipped: number } {
  const byDay = new Map<string, number>()
  let skipped = 0
  for (const p of payments) {
    if (p.status !== 'paid' || !p.paidAt) continue
    if (p.amount.currency !== 'EUR') {
      skipped++
      continue
    }
    const day = dayOf(new Date(p.paidAt))
    const refunded = p.amountRefunded && p.amountRefunded.currency === 'EUR' ? Number(p.amountRefunded.value) : 0
    byDay.set(day, (byDay.get(day) ?? 0) + Number(p.amount.value) - refunded)
  }
  return { points: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value: Math.round(value * 100) / 100 })), skipped }
}

/** Mollie writes intervals as "1 month", "3 months", "14 days", "2 weeks", "12 months": worth this much per month. */
export function mollieInterval(interval: string): number | null {
  const match = interval.trim().match(/^(\d+)\s+(day|days|week|weeks|month|months)$/)
  if (!match) return null
  const n = Math.max(1, Number(match[1]))
  const unit = match[2]
  if (unit.startsWith('day')) return 365 / 12 / n
  if (unit.startsWith('week')) return 52 / 12 / n
  return 1 / n
}

export function mollieMrr(subscriptions: MollieSubscription[]): { mrr: number; customers: number; skipped: number } {
  let mrr = 0
  let skipped = 0
  const customers = new Set<string>()
  for (const sub of subscriptions) {
    if (sub.status !== 'active') continue
    const factor = mollieInterval(sub.interval)
    if (sub.amount.currency !== 'EUR' || factor == null) {
      skipped++
      continue
    }
    mrr += Number(sub.amount.value) * factor
    if (sub.customerId) customers.add(sub.customerId)
  }
  return { mrr: Math.round(mrr * 100) / 100, customers: customers.size, skipped }
}

/** Only an organization access token, which can be limited to reading; an API key can also refund. */
export function checkMollieKey(key: string): string | null {
  if (/^(live|test)_/.test(key)) return 'Dat is een API-sleutel (live_… of test_…): daarmee kan ook geld teruggeboekt worden. Maak in Mollie een organisatietoken (access_…) met alleen payments.read en subscriptions.read.'
  if (!/^access_[A-Za-z0-9]+$/.test(key)) return 'Een Mollie-organisatietoken begint met access_.'
  return null
}
