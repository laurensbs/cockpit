import 'server-only'
import { addDays, dayOf } from '@/lib/dates'

// Answers in the shape of Stripe, Mollie, Plausible, Google, Discord and an own app, relative to today,
// for the tests only (the runner uses this only when fixturesAllowed() and COCKPIT_FAKE_CONNECTORS=1).
// A key with "bad" in it is refused, so the error path can be tested too.

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const days = (n: number) => {
  const today = dayOf(new Date())
  return Array.from({ length: n }, (_, i) => ({ day: addDays(today, -i), i }))
}

export const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const auth = new Headers(init?.headers).get('authorization') ?? ''
  if (auth.includes('bad')) return json({ error: { message: 'Invalid API Key provided: rk_bad_…' } }, 401)

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
  if (url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token') {
    const assertion = new URLSearchParams(String(init?.body ?? '')).get('assertion') ?? ''
    const claims = JSON.parse(Buffer.from(assertion.split('.')[1] ?? '', 'base64url').toString() || '{}') as { iss?: string; scope?: string }
    if (!claims.iss || claims.iss.includes('bad')) return json({ error: 'invalid_grant' }, 400)
    return json({ access_token: `ya29.fixture.${claims.scope?.endsWith('webmasters.readonly') ? 'gsc' : 'ga4'}`, expires_in: 3599, token_type: 'Bearer' })
  }
  if (url.hostname === 'analyticsdata.googleapis.com' && url.pathname.endsWith(':runReport')) {
    if (auth !== 'Bearer ya29.fixture.ga4') return json({ error: { code: 401 } }, 401)
    if (url.pathname.includes('/properties/403')) return json({ error: { code: 403 } }, 403)
    const body = JSON.parse(String(init?.body ?? '{}')) as { dateRanges: { startDate: string; endDate: string }[]; metrics: { name: string }[] }
    const { startDate, endDate } = body.dateRanges[0]
    const rows = days(400)
      .filter(({ day }) => day >= startDate && day <= endDate)
      .map(({ day, i }) => ({
        dimensionValues: [{ value: day.replace(/-/g, '') }],
        metricValues: body.metrics.map((m) => ({ value: String(m.name === 'activeUsers' ? 30 + (i % 9) : m.name === 'screenPageViews' ? 70 + (i % 13) : i % 4 === 0 ? 1 : 0) })),
      }))
    return json({ rows, rowCount: rows.length })
  }
  if (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/webmasters/v3/sites/') && url.pathname.endsWith('/searchAnalytics/query')) {
    if (auth !== 'Bearer ya29.fixture.gsc') return json({ error: { code: 401 } }, 401)
    const body = JSON.parse(String(init?.body ?? '{}')) as { startDate: string; endDate: string }
    const lag = addDays(dayOf(new Date()), -3)
    const rows = days(400)
      .filter(({ day }) => day >= body.startDate && day <= body.endDate && day <= lag)
      .map(({ day, i }) => ({ keys: [day], clicks: 5 + (i % 6), impressions: 180 + (i % 40), ctr: 0.03, position: 14.2 }))
    return json({ rows })
  }
  if (url.hostname === 'discord.com' && url.pathname.startsWith('/api/v10/invites/')) {
    if (url.pathname.endsWith('/verlopen')) return json({ message: 'Unknown Invite', code: 10006 }, 404)
    return json({ code: url.pathname.split('/').pop(), approximate_member_count: 812, approximate_presence_count: 97 })
  }
  if (url.hostname === 'stats.rondje.test' && url.pathname === '/api/stats') {
    if (auth !== 'Bearer rondje-stats-geheim') return json({ error: 'unauthorized' }, 401)
    const series = days(30).map(({ day, i }) => ({ day, metrics: { signups: 2 + (i % 5) } }))
    return json({ metrics: { users: 412, active_users: 120, walks: 77 }, series })
  }
  return json({ error: 'not found' }, 404)
}
