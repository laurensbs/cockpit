import 'server-only'
import { checkMollieKey, type MolliePayment, mollieMrr, mollieRevenueByDay, type MollieSubscription } from '@/lib/connectors/mollie'
import { getJson } from './http'
import type { ConnectorKind, PulledPoint } from './types'

const API = 'https://api.mollie.com/v2'
const MAX_PAGES = 20

interface List<K extends string, T> {
  _embedded?: Record<K, T[]>
  _links?: { next?: { href: string } | null }
}

/** Pages through a list, newest first, until `stop` says the rest is older than needed. */
async function all<K extends string, T>(ctx: { fetch: typeof fetch; secret: string }, first: string, key: K, stop?: (item: T) => boolean): Promise<T[]> {
  const out: T[] = []
  let url: string | null = first
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res: List<K, T> = await getJson<List<K, T>>(ctx.fetch, url, { headers: { Authorization: `Bearer ${ctx.secret}` } })
    const items = res._embedded?.[key] ?? []
    out.push(...items)
    if (stop && items.some(stop)) break
    url = res._links?.next?.href ?? null
    if (url && !url.startsWith(API)) break
  }
  return out
}

export const mollie: ConnectorKind = {
  kind: 'mollie',
  label: 'Mollie',
  source: 'mollie',
  delivers: ['revenue', 'mrr', 'customers'],
  fields: [
    { name: 'profileId', label: 'Profiel-ID', placeholder: 'pfl_…', hint: 'Mollie → Instellingen → Websiteprofielen.', required: true },
    {
      name: 'mode',
      label: 'Modus',
      required: false,
      options: [
        { value: 'live', label: 'Live' },
        { value: 'test', label: 'Test' },
      ],
    },
  ],
  secret: {
    label: 'Organisatietoken (access_…)',
    placeholder: 'access_…',
    hint: 'Mollie → Developers → Organization access tokens: alleen payments.read en subscriptions.read.',
  },
  checkSecret: checkMollieKey,
  window: { first: 120, again: 35 },
  async pull(ctx) {
    const profile = (ctx.config.profileId ?? '').trim()
    if (!/^pfl_[A-Za-z0-9]+$/.test(profile)) throw new Error('profile')
    const query = `profileId=${profile}&limit=250${ctx.config.mode === 'test' ? '&testmode=true' : ''}`
    const payments = await all<'payments', MolliePayment>(ctx, `${API}/payments?${query}`, 'payments', (p) => p.createdAt.slice(0, 10) < ctx.from)
    const subscriptions = await all<'subscriptions', MollieSubscription>(ctx, `${API}/subscriptions?${query}`, 'subscriptions')
    const revenue = mollieRevenueByDay(payments)
    const recurring = mollieMrr(subscriptions)
    const points: PulledPoint[] = [
      ...revenue.points.filter((p) => p.day >= ctx.from).map((p) => ({ key: 'revenue' as const, ...p })),
      { key: 'mrr', day: ctx.today, value: recurring.mrr },
      { key: 'customers', day: ctx.today, value: recurring.customers },
    ]
    const skipped = revenue.skipped + recurring.skipped
    return { points, note: skipped ? `${skipped} betaling(en) of abonnement(en) in een andere valuta dan euro overgeslagen.` : undefined }
  },
}
