import 'server-only'
import { plausibleQuery, type PlausibleResult, plausibleRows } from '@/lib/connectors/plausible'
import { getJson } from './http'
import type { ConnectorKind, PulledPoint } from './types'

export const plausible: ConnectorKind = {
  kind: 'plausible',
  label: 'Plausible',
  source: 'plausible',
  delivers: ['visitors', 'pageviews', 'leads'],
  fields: [
    { name: 'siteId', label: 'Site', placeholder: 'webstability.nl', hint: 'Zoals de site in Plausible heet.', required: true },
    { name: 'goal', label: 'Doel dat een lead is (optioneel)', placeholder: 'Contact', hint: 'De naam van een doel in Plausible, bijvoorbeeld het contactformulier.', required: false },
    { name: 'baseUrl', label: 'Eigen server (optioneel)', placeholder: 'https://plausible.io', required: false },
  ],
  secret: { label: 'API-sleutel', placeholder: '…', hint: 'Plausible → Account → API keys → Stats API.' },
  checkSecret: (key) => (key.trim().length >= 16 ? null : 'Een Plausible-sleutel is langer.'),
  window: { first: 120, again: 10 },
  async pull(ctx) {
    const site = (ctx.config.siteId ?? '').trim()
    if (!site) throw new Error('site')
    const base = (ctx.config.baseUrl || 'https://plausible.io').replace(/\/+$/, '')
    if (!/^https:\/\//.test(base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error('base')
    const post = (body: object) =>
      getJson<PlausibleResult>(ctx.fetch, `${base}/api/v2/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ctx.secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    const traffic = plausibleRows(await post(plausibleQuery(site, ctx.from, ctx.today)), ['visitors', 'pageviews'])
    const goal = (ctx.config.goal ?? '').trim()
    const leads = goal ? plausibleRows(await post(plausibleQuery(site, ctx.from, ctx.today, goal)), ['leads']) : []
    return { points: [...traffic, ...leads] as PulledPoint[] }
  },
}
