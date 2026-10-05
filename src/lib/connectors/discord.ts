// Discord: members and who is online, from a server's public invite. No key needed. Pure.

/** The invite code from "abc123", "discord.gg/abc123" or "https://discord.com/invite/abc123". */
export function inviteCode(input: string): string | null {
  const text = input.trim()
  const match = text.match(/^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})\/?$/) ?? text.match(/^([A-Za-z0-9-]{2,32})$/)
  return match ? match[1] : null
}

export interface DiscordInvite {
  approximate_member_count?: number
  approximate_presence_count?: number
}

export function discordCounts(invite: DiscordInvite): { members: number | null; online: number | null } {
  return {
    members: typeof invite.approximate_member_count === 'number' ? invite.approximate_member_count : null,
    online: typeof invite.approximate_presence_count === 'number' ? invite.approximate_presence_count : null,
  }
}
