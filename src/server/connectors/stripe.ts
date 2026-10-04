import 'server-only'
import { checkStripeKey, type StripeCharge, stripeMrr, stripeRevenueByDay, type StripeSubscription } from '@/lib/connectors/stripe'
import { getJson } from './http'
import type { ConnectorKind, PulledPoint } from './types'

const API = 'https://api.stripe.com/v1'
const MAX_PAGES = 20

interface Page<T> {
  data: (T & { id: string })[]
  has_more: boolean
}

async function all<T>(ctx: { fetch: typeof fetch; secret: string }, path: string): Promise<T[]> {
  const out: (T & { id: string })[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const url: string = `${API}${path}${path.includes('?') ? '&' : '?'}limit=100${after ? `&starting_after=${after}` : ''}`
    const res: Page<T> = await getJson<Page<T>>(ctx.fetch, url, { headers: { Authorization: `Bearer ${ctx.secret}` } })
    out.push(...res.data)
    if (!res.has_more || !res.data.length) break
    after = res.data[res.data.length - 1].id
  }
  return out
}

export const stripe: ConnectorKind = {
  kind: 'stripe',
  label: 'Stripe',
  source: 'stripe',
  delivers: ['revenue', 'mrr', 'customers'],
  fields: [],
  secret: {
    label: 'Beperkte sleutel (rk_…)',
    placeholder: 'rk_live_…',
    hint: 'Stripe → Developers → API keys → Create restricted key: alleen Read bij Charges, Subscriptions en Customers.',
  },
  checkSecret: checkStripeKey,
  window: { first: 120, again: 35 },
  async pull(ctx) {
    // A little before the first day: a charge just after midnight in Amsterdam is still the day before in UTC.
    const since = Math.floor(Date.parse(`${ctx.from}T00:00:00Z`) / 1000) - 7200
    const charges = await all<StripeCharge>(ctx, `/charges?created[gte]=${since}`)
    const subscriptions = await all<StripeSubscription>(ctx, '/subscriptions?status=active')
    const revenue = stripeRevenueByDay(charges)
    const recurring = stripeMrr(subscriptions)
    const points: PulledPoint[] = [
      ...revenue.points.filter((p) => p.day >= ctx.from).map((p) => ({ key: 'revenue' as const, ...p })),
      { key: 'mrr', day: ctx.today, value: recurring.mrr },
      { key: 'customers', day: ctx.today, value: recurring.customers },
    ]
    const skipped = revenue.skipped + recurring.skipped
    return { points, note: skipped ? `${skipped} betaling(en) of abonnement(en) in een andere valuta dan euro overgeslagen.` : undefined }
  },
}
