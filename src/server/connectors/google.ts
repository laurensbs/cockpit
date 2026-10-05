import 'server-only'
import { createHash } from 'node:crypto'
import { checkGscSite, type Ga4Report, ga4Rows, type GscReport, gscRows } from '@/lib/connectors/google'
import type { Db } from '@/db'
import { jwtAssertion, parseServiceAccount, type ServiceAccount } from '@/lib/google-jwt'
import { getSetting } from '../settings'
import { ConnectorConfigError, ConnectorError, getJson } from './http'
import type { ConnectorKind, Fetch, PulledPoint } from './types'

/** Where the owner's service account is kept: one for all projects. */
export const GOOGLE_ACCOUNT_SETTING = 'google_service_account'

/** The e-mail address of the stored service account, to show; never the key. */
export async function googleAccountEmail(db: Db, ownerId: string): Promise<string | null> {
  const stored = await getSetting(db, ownerId, GOOGLE_ACCOUNT_SETTING)
  if (!stored) return null
  const parsed = parseServiceAccount(stored)
  return 'error' in parsed ? null : parsed.client_email
}

const SHARED = { setting: GOOGLE_ACCOUNT_SETTING, missing: 'Zet eerst het Google-service-account in Instellingen → Bronnen.' }
const SCOPES = { ga4: 'https://www.googleapis.com/auth/analytics.readonly', gsc: 'https://www.googleapis.com/auth/webmasters.readonly' }

// Access tokens live an hour; reuse one for 55 minutes. Keyed by the account's key, so a new key file
// never uses an old token.
const tokens = new Map<string, { token: string; until: number }>()

function account(shared: string): ServiceAccount {
  const parsed = parseServiceAccount(shared)
  if ('error' in parsed) throw new ConnectorConfigError('Het Google-service-account klopt niet meer. Plak het sleutelbestand opnieuw in Instellingen → Bronnen.')
  return parsed
}

async function accessToken(fetchFn: Fetch, sa: ServiceAccount, scope: string, nowMs = Date.now()): Promise<string> {
  const cacheKey = createHash('sha256').update(`${sa.private_key}\n${scope}`).digest('hex')
  const cached = tokens.get(cacheKey)
  if (cached && cached.until > nowMs) return cached.token
  try {
    const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwtAssertion(sa, scope, nowMs) })
    const res = await getJson<{ access_token?: string; expires_in?: number }>(fetchFn, sa.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.access_token) throw new ConnectorError(502)
    tokens.set(cacheKey, { token: res.access_token, until: nowMs + Math.min(55 * 60, Math.max(60, (res.expires_in ?? 3600) - 300)) * 1000 })
    return res.access_token
  } catch (error) {
    if (error instanceof ConnectorError && error.status >= 400 && error.status < 500) throw new ConnectorConfigError('Google accepteert het service-account niet. Maak een nieuwe sleutel en plak die in Instellingen → Bronnen.')
    throw error
  }
}

/** A Google API call; a refusal names the account, so he knows whom to give access. */
async function googleCall<T>(fetchFn: Fetch, sa: ServiceAccount, scope: string, url: string, body: object, noAccess: string): Promise<T> {
  const token = await accessToken(fetchFn, sa, scope)
  try {
    return await getJson<T>(fetchFn, url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch (error) {
    if (error instanceof ConnectorError && error.status === 403) throw new ConnectorConfigError(noAccess.replace('{email}', sa.client_email))
    throw error
  }
}

const EVENT_KEYS = [
  { value: 'leads', label: 'Leads' },
  { value: 'signups', label: 'Aanmeldingen' },
]

export const ga4: ConnectorKind = {
  kind: 'ga4',
  label: 'Google Analytics 4',
  source: 'ga4',
  delivers: ['visitors', 'pageviews', 'leads', 'signups'],
  fields: [
    { name: 'propertyId', label: 'Property-ID', placeholder: '412345678', hint: 'GA4 → Beheer → Property-instellingen: het nummer bovenaan.', required: true },
    { name: 'event', label: 'Sleutelgebeurtenis (optioneel)', placeholder: 'generate_lead', hint: 'De naam van een key event, zoals het contactformulier of een aanmelding.', required: false },
    { name: 'eventKey', label: 'Die gebeurtenis telt als', required: false, options: EVENT_KEYS },
  ],
  secret: null,
  checkSecret: () => null,
  shared: SHARED,
  checkConfig: (c) => {
    if (!/^\d{5,15}$/.test((c.propertyId ?? '').trim())) return 'Het property-ID is een nummer, zoals 412345678.'
    if (c.event && !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(c.event.trim())) return 'Een gebeurtenis heet zoiets als generate_lead (letters, cijfers en _).'
    return null
  },
  window: { first: 120, again: 10 },
  async pull(ctx) {
    const problem = ga4.checkConfig?.(ctx.config)
    if (problem) throw new ConnectorConfigError(problem)
    const sa = account(ctx.shared)
    const event = (ctx.config.event ?? '').trim()
    const eventKey = ctx.config.eventKey === 'signups' ? 'signups' : 'leads'
    const names = ['visitors', 'pageviews', ...(event ? [eventKey] : [])]
    const report = await googleCall<Ga4Report>(
      ctx.fetch,
      sa,
      SCOPES.ga4,
      `https://analyticsdata.googleapis.com/v1beta/properties/${ctx.config.propertyId.trim()}:runReport`,
      {
        dateRanges: [{ startDate: ctx.from, endDate: ctx.today }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, ...(event ? [{ name: `keyEvents:${event}` }] : [])],
        keepEmptyRows: true,
        limit: 1000,
      },
      'Geef {email} leesrechten op deze property: GA4 → Beheer → Toegangsbeheer voor property → Kijker.',
    )
    return { points: ga4Rows(report, names) as PulledPoint[] }
  },
}

export const gsc: ConnectorKind = {
  kind: 'gsc',
  label: 'Google Search Console',
  source: 'gsc',
  delivers: ['search_clicks', 'search_impressions'],
  fields: [{ name: 'siteUrl', label: 'Property', placeholder: 'sc-domain:webstability.nl', hint: 'Een domein (sc-domain:jouwsite.nl) of een adres dat op / eindigt.', required: true }],
  secret: null,
  checkSecret: () => null,
  shared: SHARED,
  checkConfig: (c) => checkGscSite((c.siteUrl ?? '').trim()),
  window: { first: 120, again: 10 },
  async pull(ctx) {
    const site = (ctx.config.siteUrl ?? '').trim()
    const problem = checkGscSite(site)
    if (problem) throw new ConnectorConfigError(problem)
    const sa = account(ctx.shared)
    const report = await googleCall<GscReport>(
      ctx.fetch,
      sa,
      SCOPES.gsc,
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
      { startDate: ctx.from, endDate: ctx.today, dimensions: ['date'], rowLimit: 1000 },
      'Voeg {email} toe als gebruiker (beperkt) in Search Console → Instellingen → Gebruikers en rechten.',
    )
    // Search Console lags about three days; a pull of ten days fills those in later.
    return { points: gscRows(report) as PulledPoint[] }
  },
}
