import 'server-only'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { addDays, dayOf } from '@/lib/dates'

// Answers in the shape of Stripe, Mollie, Plausible, Google, Discord and an own app, relative to today,
// for the tests only (the runner uses this only when fixturesAllowed() and COCKPIT_FAKE_CONNECTORS=1).
// A key with "bad" in it is refused, so the error path can be tested too.

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const days = (n: number) => {
  const today = dayOf(new Date())
  return Array.from({ length: n }, (_, i) => ({ day: addDays(today, -i), i }))
}

/** The publishing calls, written down for the tests (never a token). */
function log(entry: Record<string, unknown>) {
  const file = process.env.COCKPIT_FIXTURE_LOG
  if (!file) return
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify(entry)}\n`)
}

const formOf = (body: unknown) => (body instanceof URLSearchParams ? body : new URLSearchParams(typeof body === 'string' ? body : ''))
const jsonOf = (body: unknown) => {
  try {
    return JSON.parse(typeof body === 'string' ? body : '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}
const sizeOf = (body: unknown) => (body instanceof Uint8Array ? body.length : typeof body === 'string' ? body.length : 0)
let igContainers = 0

export const fixtureFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const headers = new Headers(init?.headers)
  const auth = headers.get('authorization') ?? ''
  const method = init?.method ?? 'GET'
  if (auth.includes('bad')) return json({ error: { message: 'Invalid API Key provided: rk_bad_…' } }, 401)

  // LinkedIn: logging in, uploads and posts as a member.
  if (url.hostname === 'www.linkedin.com' && url.pathname === '/oauth/v2/accessToken') {
    const form = formOf(init?.body)
    if (form.get('code') !== 'li-code' || !form.get('client_secret')) return json({ error: 'invalid_request' }, 400)
    return json({ access_token: 'li-fixture-token', expires_in: 5_184_000 })
  }
  if (url.hostname === 'api.linkedin.com' && url.pathname === '/v2/userinfo') {
    return auth === 'Bearer li-fixture-token' ? json({ sub: 'fixture-sub', name: 'Test Ondernemer' }) : json({ message: 'unauthorized' }, 401)
  }
  if (url.hostname === 'api.linkedin.com' && url.pathname.startsWith('/rest/')) {
    if (auth !== 'Bearer li-fixture-token' || !headers.get('linkedin-version')) return json({ message: 'unauthorized' }, 401)
    const action = url.searchParams.get('action')
    if (url.pathname === '/rest/images' && action === 'initializeUpload') return json({ value: { uploadUrl: 'https://www.linkedin.com/dms-uploads/image-1', image: 'urn:li:image:F1' } })
    if (url.pathname === '/rest/documents' && action === 'initializeUpload') return json({ value: { uploadUrl: 'https://www.linkedin.com/dms-uploads/document-1', document: 'urn:li:document:F1' } })
    if (url.pathname === '/rest/videos' && action === 'initializeUpload') {
      const size = Number((jsonOf(init?.body).initializeUploadRequest as { fileSizeBytes?: number })?.fileSizeBytes ?? 0)
      return json({ value: { video: 'urn:li:video:F1', uploadToken: '', uploadInstructions: [{ uploadUrl: 'https://www.linkedin.com/dms-uploads/video-1', firstByte: 0, lastByte: size - 1 }] } })
    }
    if (url.pathname === '/rest/videos' && action === 'finalizeUpload') return json({})
    if (url.pathname === '/rest/posts' && method === 'POST') {
      const body = jsonOf(init?.body)
      // Two words in a test post make LinkedIn fail: once in a way that may pass, once for good.
      if (String(body.commentary).includes('FAIL-ME')) return json({ message: 'busy' }, 503)
      if (String(body.commentary).includes('REFUSE-ME')) return json({ message: 'refused' }, 422)
      log({ platform: 'linkedin', call: 'post', commentary: body.commentary, media: (body.content as { media?: { id?: string } })?.media?.id ?? null })
      return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:7380000000000000001' } })
    }
  }
  if (url.hostname === 'www.linkedin.com' && url.pathname.startsWith('/dms-uploads/')) {
    log({ platform: 'linkedin', call: 'upload', what: url.pathname.split('/').pop(), bytes: sizeOf(init?.body) })
    return new Response(null, { status: 201, headers: { etag: '"etag-1"' } })
  }

  // Instagram (Instagram Login): a container per picture or video, then publishing it.
  if (url.hostname === 'graph.instagram.com') {
    const form = method === 'POST' ? formOf(init?.body) : url.searchParams
    const token = form.get('access_token') ?? url.searchParams.get('access_token') ?? ''
    if (!token || token.includes('bad')) return json({ error: { message: 'Invalid OAuth access token', code: 190 } }, 400)
    if (url.pathname === '/v23.0/me') return json({ user_id: '17841400000000001', username: 'webstability' })
    if (url.pathname === '/refresh_access_token') return json({ access_token: token, token_type: 'bearer', expires_in: 5_184_000 })
    if (url.pathname.endsWith('/media') && method === 'POST') {
      for (const key of ['image_url', 'video_url']) if (form.get(key) && !form.get(key)!.startsWith('https://blob.fixture.test/')) return json({ error: { message: 'media url not public' } }, 400)
      igContainers++
      log({ platform: 'instagram', call: 'container', media_type: form.get('media_type') ?? 'IMAGE', carousel_item: form.get('is_carousel_item') === 'true', children: form.get('children')?.split(',').length ?? 0, caption: form.get('caption') ?? null })
      return json({ id: `container-${igContainers}` })
    }
    if (url.pathname.endsWith('/media_publish') && method === 'POST') {
      log({ platform: 'instagram', call: 'publish', creation_id: form.get('creation_id') })
      return json({ id: '17900000000000001' })
    }
    if (url.pathname.startsWith('/v23.0/container-')) return json({ status_code: 'FINISHED', id: url.pathname.split('/').pop() })
    if (url.pathname === '/v23.0/17900000000000001') return json({ permalink: 'https://www.instagram.com/p/FIXTURE1/', id: '17900000000000001' })
  }

  // TikTok: logging in (PKCE), and a video into his drafts.
  if (url.hostname === 'open.tiktokapis.com') {
    if (url.pathname === '/v2/oauth/token/') {
      const form = formOf(init?.body)
      if (form.get('grant_type') === 'authorization_code' && (form.get('code') !== 'tt-code' || !form.get('code_verifier'))) return json({ error: 'invalid_grant' }, 400)
      return json({ access_token: 'act.fixture', expires_in: 86_400, refresh_token: 'rft.fixture', refresh_expires_in: 31_536_000, open_id: 'open-fixture', scope: 'video.upload', token_type: 'Bearer' })
    }
    if (auth !== 'Bearer act.fixture') return json({ error: { code: 'access_token_invalid' } }, 401)
    if (url.pathname === '/v2/user/info/') return json({ data: { user: { display_name: 'rondje.app' } }, error: { code: 'ok' } })
    if (url.pathname === '/v2/post/publish/inbox/video/init/') {
      const info = (jsonOf(init?.body).source_info ?? {}) as Record<string, unknown>
      log({ platform: 'tiktok', call: 'init', source: info.source, video_size: info.video_size })
      return json({ data: { publish_id: 'v_inbox_file~v2.1', upload_url: 'https://open-upload.tiktokapis.com/video/?upload_id=1' }, error: { code: 'ok' } })
    }
    if (url.pathname === '/v2/post/publish/status/fetch/') return json({ data: { status: 'SEND_TO_USER_INBOX' }, error: { code: 'ok' } })
  }
  if (url.hostname === 'open-upload.tiktokapis.com') {
    if (!headers.get('content-range')) return json({ error: 'no range' }, 400)
    log({ platform: 'tiktok', call: 'upload', bytes: sizeOf(init?.body), range: headers.get('content-range') })
    return new Response(null, { status: 201 })
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
