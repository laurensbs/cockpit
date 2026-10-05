import 'server-only'
import { addDays, dayOf } from '@/lib/dates'

// Answers in the shape of Stripe, Mollie and Plausible, relative to today, for the tests only (the
// runner uses this only when fixturesAllowed() and COCKPIT_FAKE_CONNECTORS=1). A key with "bad" in it
// is refused, so the error path can be tested too.

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const days = (n: number) => {
  const today = dayOf(new Date())
  return Array.from({ length: n }, (_, i) => ({ day: addDays(today, -i), i }))
}

export const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const auth = new Headers(init?.headers).get('authorization') ?? ''
  if (auth.includes('bad')) return json({ error: { message: 'Invalid API Key provided: rk_bad_…' } }, 401)

  if ((url.hostname === 'graph.facebook.com' || url.hostname === 'graph.instagram.com') && (url.searchParams.get('access_token') ?? '').includes('bad')) {
    return json({ error: { message: 'Invalid OAuth access token' } }, 401)
  }
  if ((url.hostname === 'graph.facebook.com' || url.hostname === 'graph.instagram.com') && url.pathname.endsWith('/insights')) {
    const values = days(28).map(({ day, i }) => ({ value: 300 + ((i * 37) % 120), end_time: `${addDays(day, 1)}T07:00:00+0000` }))
    return json({ data: [{ name: 'reach', period: 'day', values }] })
  }
  if (url.hostname === 'graph.facebook.com' || url.hostname === 'graph.instagram.com') {
    return json({ id: url.pathname.split('/').pop(), followers_count: 1234, media_count: 56 })
  }
  if (url.hostname === 'api.stripe.com' && url.pathname === '/v1/charges') {
    const charges = days(120)
      .filter(({ i }) => i % 4 === 0)
      .map(({ day, i }) => ({ id: `ch_${i}`, amount: 14900, amount_refunded: 0, currency: 'eur', status: 'succeeded', paid: true, created: Date.parse(`${day}T11:00:00Z`) / 1000 }))
    return json({ data: charges, has_more: false })
  }
  if (url.hostname === 'api.stripe.com' && url.pathname === '/v1/subscriptions') {
    const subs = Array.from({ length: 6 }, (_, i) => ({
      id: `sub_${i}`,
      status: 'active',
      customer: `cus_${i}`,
      items: { data: [{ quantity: 1, price: { unit_amount: 14900, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } } }] },
    }))
    return json({ data: subs, has_more: false })
  }
  if (url.hostname === 'api.mollie.com' && url.pathname === '/v2/payments') {
    const payments = days(120)
      .filter(({ i }) => i % 7 === 2)
      .map(({ day }) => ({ status: 'paid', amount: { value: '99.00', currency: 'EUR' }, paidAt: `${day}T10:00:00+00:00`, createdAt: `${day}T10:00:00+00:00` }))
    return json({ _embedded: { payments }, _links: { next: null } })
  }
  if (url.hostname === 'api.mollie.com' && url.pathname === '/v2/subscriptions') {
    const subscriptions = [0, 1].map((i) => ({ status: 'active', amount: { value: '99.00', currency: 'EUR' }, interval: '1 month', customerId: `cst_${i}` }))
    return json({ _embedded: { subscriptions }, _links: { next: null } })
  }
  if (url.pathname === '/api/v2/query') {
    const body = JSON.parse(String(init?.body ?? '{}')) as { date_range: [string, string]; filters?: unknown[] }
    const [from, to] = body.date_range
    const inRange = days(400).filter(({ day }) => day >= from && day <= to)
    if (body.filters?.length) return json({ results: inRange.map(({ day, i }) => ({ dimensions: [day], metrics: [i % 3 === 0 ? 1 : 0] })) })
    return json({ results: inRange.map(({ day, i }) => ({ dimensions: [day], metrics: [40 + ((i * 7) % 23), 2 * (40 + ((i * 7) % 23)) + 3] })) })
  }
  return json({ error: 'not found' }, 404)
}
