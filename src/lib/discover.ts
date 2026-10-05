// Finding what belongs to a project without him typing it: the site's real domain (from Vercel or
// GitHub), and on the site itself which tools run there (Plausible, Google Analytics, Vercel
// Analytics, Stripe) and which Discord it links to. Pure, so the choices are predictable and tested.

export interface SiteScan {
  /** The domain Plausible counts this site under (its script's data-domain). */
  plausible: string | null
  /** Google Analytics 4 measurement ids (G-…). */
  ga4: string[]
  vercelAnalytics: boolean
  stripe: boolean
  discord: string[]
  canonical: string | null
}

const unique = <T,>(list: T[]) => [...new Set(list)]

/** Discord invite codes in any text: discord.gg/abc, discord.com/invite/abc. */
export function discordInvites(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]{2,32})/g)) out.push(m[1])
  return unique(out).slice(0, 3)
}

/** What a page's HTML says about the tools on the site. */
export function scanHtml(html: string): SiteScan {
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0])
  const plausibleTag = scripts.find((s) => /plausible/i.test(s) && /data-domain=/i.test(s))
  const plausible = plausibleTag?.match(/data-domain=["']([^"']+)["']/i)?.[1]?.split(',')[0]?.trim().toLowerCase() ?? null
  const ga4 = unique([...html.matchAll(/\b(G-[A-Z0-9]{6,12})\b/g)].map((m) => m[1])).slice(0, 3)
  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0]?.match(/href=["']([^"']+)["']/i)?.[1] ?? null
  return {
    plausible: plausible && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(plausible) ? plausible : null,
    ga4,
    vercelAnalytics: /\/_vercel\/insights\/script\.js|va\.vercel-scripts\.com/.test(html),
    stripe: /js\.stripe\.com|buy\.stripe\.com|checkout\.stripe\.com/.test(html),
    discord: discordInvites(html),
    canonical: canonical && /^https:\/\//.test(canonical) ? canonical : null,
  }
}

export interface VercelDomain {
  name: string
  verified?: boolean
  redirect?: string | null
}

/** The production domain to call the site: his own (not *.vercel.app), verified, not a redirect, shortest. */
export function pickDomain(domains: VercelDomain[]): string | null {
  const usable = domains.filter((d) => d.name && !d.redirect && d.verified !== false)
  const own = usable.filter((d) => !d.name.endsWith('.vercel.app')).sort((a, b) => a.name.length - b.name.length)
  return own[0]?.name ?? usable.sort((a, b) => a.name.length - b.name.length)[0]?.name ?? null
}

/** The host without www. */
export const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, '')

export function hostOfUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return bareHost(new URL(url).hostname)
  } catch {
    return null
  }
}

/** The Search Console property that covers a host: the domain property first, else a URL prefix of the host. */
export function gscSiteFor(host: string, sites: { siteUrl: string; permissionLevel?: string }[]): string | null {
  const h = bareHost(host)
  const ok = sites.filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
  const domain = ok.find((s) => s.siteUrl.toLowerCase() === `sc-domain:${h}` || (s.siteUrl.startsWith('sc-domain:') && h.endsWith(`.${s.siteUrl.slice(10).toLowerCase()}`)))
  if (domain) return domain.siteUrl
  return ok.find((s) => /^https?:\/\//.test(s.siteUrl) && hostOfUrl(s.siteUrl) === h)?.siteUrl ?? null
}

export interface Ga4Stream {
  property: string
  measurementId: string | null
  defaultUri: string | null
}

/** The GA4 property of a site: by the measurement id on the site, else by the stream's address. */
export function ga4PropertyFor(measurementIds: string[], host: string | null, streams: Ga4Stream[]): string | null {
  const byId = streams.find((s) => s.measurementId && measurementIds.includes(s.measurementId))
  if (byId) return byId.property
  if (!host) return null
  return streams.find((s) => hostOfUrl(s.defaultUri) === bareHost(host))?.property ?? null
}

/** Does a Vercel project belong to one of these repositories (owner/name)? */
export function vercelRepoOf(link: { type?: string; org?: string; repo?: string } | null | undefined): string | null {
  if (!link || (link.type && link.type !== 'github') || !link.org || !link.repo) return null
  return `${link.org}/${link.repo}`.toLowerCase()
}

export type FoundKind = 'site' | 'vercel' | 'plausible' | 'ga4' | 'gsc' | 'discord' | 'stripe' | 'vercel-analytics'
export type FoundStatus = 'linked' | 'suggested' | 'seen'

export interface Found {
  kind: FoundKind
  value: string
  /** Where it was found, in his words: "via Vercel", "op je site", "in je README". */
  from: string
  status: FoundStatus
  /** For a suggestion: what he does once. */
  todo?: string
}

export interface Discovered {
  at: string
  items: Found[]
  vercel?: { name: string; state: string | null; url: string | null }
  /** Kinds he undid: never linked again on their own. */
  dismissed?: string[]
}

export const FOUND_LABELS: Record<FoundKind, string> = {
  site: 'Site',
  vercel: 'Vercel',
  plausible: 'Plausible',
  ga4: 'Google Analytics',
  gsc: 'Search Console',
  discord: 'Discord',
  stripe: 'Stripe',
  'vercel-analytics': 'Vercel Analytics',
}
