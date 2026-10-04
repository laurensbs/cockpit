// Stripe, read-only: revenue per Amsterdam day from charges (minus what was refunded), and MRR plus the
// number of paying customers from active subscriptions. Only euros; other currencies are counted and
// left out. Pure: the server fetches, these functions read.

import { dayOf } from '../dates'

export interface StripeCharge {
  amount: number
  amount_refunded?: number
  currency: string
  status: string
  paid?: boolean
  created: number
}

export interface StripeSubscription {
  status: string
  customer: string | { id: string }
  items: { data: { quantity?: number | null; price: { unit_amount: number | null; currency: string; recurring: { interval: string; interval_count?: number } | null } }[] }
}

/** Revenue per day (euros), and how many charges in another currency were left out. */
export function stripeRevenueByDay(charges: StripeCharge[]): { points: { day: string; value: number }[]; skipped: number } {
  const byDay = new Map<string, number>()
  let skipped = 0
  for (const c of charges) {
    if (c.status !== 'succeeded' || c.paid === false) continue
    if (c.currency.toLowerCase() !== 'eur') {
      skipped++
      continue
    }
    const day = dayOf(new Date(c.created * 1000))
    byDay.set(day, (byDay.get(day) ?? 0) + (c.amount - (c.amount_refunded ?? 0)) / 100)
  }
  return { points: [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value: Math.round(value * 100) / 100 })), skipped }
}

/** What a recurring price is worth per month. */
export function monthlyFactor(interval: string, count = 1): number | null {
  const n = Math.max(1, count)
  switch (interval) {
    case 'day':
      return 365 / 12 / n
    case 'week':
      return 52 / 12 / n
    case 'month':
      return 1 / n
    case 'year':
      return 1 / 12 / n
    default:
      return null
  }
}

/** MRR in euros and the number of customers with an active (or trialing past-due) subscription. */
export function stripeMrr(subscriptions: StripeSubscription[]): { mrr: number; customers: number; skipped: number } {
  let mrr = 0
  let skipped = 0
  const customers = new Set<string>()
  for (const sub of subscriptions) {
    if (sub.status !== 'active' && sub.status !== 'past_due') continue
    customers.add(typeof sub.customer === 'string' ? sub.customer : sub.customer.id)
    for (const item of sub.items.data) {
      const price = item.price
      const factor = price.recurring ? monthlyFactor(price.recurring.interval, price.recurring.interval_count) : null
      if (price.currency.toLowerCase() !== 'eur' || price.unit_amount == null || factor == null) {
        skipped++
        continue
      }
      mrr += (price.unit_amount / 100) * (item.quantity ?? 1) * factor
    }
  }
  return { mrr: Math.round(mrr * 100) / 100, customers: customers.size, skipped }
}

/** Only restricted keys: a secret key could also create refunds. */
export function checkStripeKey(key: string): string | null {
  if (/^sk_/.test(key)) return 'Dat is een geheime sleutel (sk_…): daarmee kan ook geld teruggeboekt worden. Maak in Stripe een beperkte sleutel (rk_…) met alleen leesrechten op Charges, Subscriptions en Customers.'
  if (!/^rk_(live|test)_[A-Za-z0-9]+$/.test(key)) return 'Een beperkte Stripe-sleutel begint met rk_live_ of rk_test_.'
  return null
}
