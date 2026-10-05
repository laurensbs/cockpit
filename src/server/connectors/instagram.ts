import 'server-only'
import { IG_VERSION, type IgInsights, type IgProfile, instagramBase, instagramPoints } from '@/lib/connectors/instagram'
import { ConnectorError, getJson } from './http'
import type { ConnectorKind } from './types'

const unix = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000)

export const instagram: ConnectorKind = {
  kind: 'instagram',
  label: 'Instagram',
  source: 'instagram',
  delivers: ['followers', 'reach'],
  fields: [
    {
      name: 'accountId',
      label: 'Instagram-account-ID',
      placeholder: '17841400000000000',
      hint: 'Het ID van je zakelijke of creator-account (Meta for Developers → je app → Instagram → API-instellingen).',
      required: true,
    },
  ],
  secret: {
    label: 'Toegangstoken (alleen lezen)',
    placeholder: 'IGQ… of EAA…',
    hint: 'Een langlevend token met alleen instagram_basic en instagram_manage_insights (lezen). De cockpit post niets.',
  },
  checkSecret: (token) => (/^(IG|EA)[A-Za-z0-9_-]{30,}$/.test(token.trim()) ? null : 'Dat lijkt geen Instagram-token (begint met IG of EA).'),
  window: { first: 28, again: 3 },
  async pull(ctx) {
    const id = (ctx.config.accountId ?? '').trim()
    if (!/^\d{5,25}$/.test(id)) throw new ConnectorError(404)
    const base = `${instagramBase(ctx.secret)}/${IG_VERSION}/${id}`
    const token = encodeURIComponent(ctx.secret.trim())
    const profile = await getJson<IgProfile>(ctx.fetch, `${base}?fields=followers_count,media_count&access_token=${token}`)
    // Reach per day; Meta allows at most 30 days per request. Without the insights permission: followers only.
    let insights: IgInsights | null = null
    try {
      insights = await getJson<IgInsights>(ctx.fetch, `${base}/insights?metric=reach&period=day&since=${unix(ctx.from)}&until=${unix(ctx.today) + 86_400}&access_token=${token}`)
    } catch {
      insights = null
    }
    const points = instagramPoints(profile, insights, ctx.today)
    return { points, note: insights ? undefined : 'Alleen volgers: het token mag het bereik niet lezen.' }
  },
}
