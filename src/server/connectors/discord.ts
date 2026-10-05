import 'server-only'
import { type DiscordInvite, discordCounts, inviteCode } from '@/lib/connectors/discord'
import { ConnectorConfigError, ConnectorError, getJson } from './http'
import type { ConnectorKind, PulledPoint } from './types'

const HEADERS = { 'User-Agent': 'Cockpit (https://github.com/laurensbs/cockpit, 1)' }

/** Members and who is online, from the server's public invite: no key, one snapshot per day. */
export const discord: ConnectorKind = {
  kind: 'discord',
  label: 'Discord',
  source: 'discord',
  delivers: ['discord_members', 'discord_online'],
  fields: [{ name: 'invite', label: 'Uitnodiging', placeholder: 'discord.gg/jouwserver', hint: 'Een uitnodiging die niet verloopt (Server → Mensen uitnodigen → Nooit verlopen).', required: true }],
  secret: null,
  checkSecret: () => null,
  checkConfig: (c) => (inviteCode(c.invite ?? '') ? null : 'Plak een uitnodiging, zoals discord.gg/jouwserver.'),
  window: { first: 1, again: 1 },
  async pull(ctx) {
    const code = inviteCode(ctx.config.invite ?? '')
    if (!code) throw new ConnectorConfigError('Plak een uitnodiging, zoals discord.gg/jouwserver.')
    const url = `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`
    let invite: DiscordInvite
    try {
      invite = await getJson<DiscordInvite>(ctx.fetch, url, { headers: HEADERS })
    } catch (error) {
      if (error instanceof ConnectorError && error.status === 404) throw new ConnectorConfigError('Deze uitnodiging bestaat niet (meer). Maak er een die niet verloopt.')
      if (!(error instanceof ConnectorError) || error.status !== 429) throw error
      // Discord limits callers without a key quickly: wait as long as it asks (at most 5 s), once.
      await new Promise((r) => setTimeout(r, Math.min(5, error.retryAfter ?? 2) * 1000))
      invite = await getJson<DiscordInvite>(ctx.fetch, url, { headers: HEADERS })
    }
    const { members, online } = discordCounts(invite)
    const points: PulledPoint[] = []
    if (members != null) points.push({ key: 'discord_members', day: ctx.today, value: members })
    if (online != null) points.push({ key: 'discord_online', day: ctx.today, value: online })
    return { points }
  },
}
