import { normalizeUrl } from './urls'

// The social profiles of a project, kept in project.links with the platform as label. He links a profile
// with one paste; the cockpit and Claude then know where he is, and posting opens the right place.

export const SOCIALS = [
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { key: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'] },
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.com'] },
  { key: 'x', label: 'X', hosts: ['x.com', 'twitter.com'] },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { key: 'google', label: 'Google', hosts: ['g.page', 'business.google.com', 'maps.app.goo.gl', 'google.com'] },
] as const

export type SocialKey = (typeof SOCIALS)[number]['key']
export type Link = { label: string; url: string }

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '').toLowerCase()

/** The profile address for a platform, or null when it is not a page of that platform. */
export function socialUrl(key: string, raw: string): string | null {
  const social = SOCIALS.find((s) => s.key === key)
  const url = normalizeUrl(raw)
  if (!social || !url) return null
  const host = hostOf(url)
  return social.hosts.some((h) => host === h || host.endsWith(`.${h}`)) ? url : null
}

/** The linked profiles of a project, by platform. */
export function socialsOf(links: Link[] | null | undefined): Partial<Record<SocialKey, string>> {
  const out: Partial<Record<SocialKey, string>> = {}
  for (const l of links ?? []) if (SOCIALS.some((s) => s.key === l.label)) out[l.label as SocialKey] = l.url
  return out
}

/** The links with this platform set to url, or removed when url is null. Other links stay as they are. */
export function withSocial(links: Link[] | null | undefined, key: SocialKey, url: string | null): Link[] {
  const rest = (links ?? []).filter((l) => l.label !== key)
  return url ? [...rest, { label: key, url }] : rest
}

/** Where a post for this project goes first: a linked platform with a share window, then any linked one. */
export function preferredPlatform(socials: Partial<Record<SocialKey, string>>): 'linkedin' | 'instagram' | 'x' | 'tiktok' {
  for (const p of ['linkedin', 'instagram', 'x', 'tiktok'] as const) if (socials[p]) return p
  return 'linkedin'
}
