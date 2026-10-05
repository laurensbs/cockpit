// What the cockpit can see for itself about a project's setup, turned into checklist rows. Pure: the
// server gathers the raw answers (DNS, the homepage, Trustpilot, the App Store, env names) and this
// decides what they mean. Only names of keys are ever read, never their values.

import type { SetupRow } from './setup'

/** Hosting subdomains: a site there has no domain of its own yet. */
const HOSTED = /\.(vercel\.app|netlify\.app|github\.io|pages\.dev|web\.app|firebaseapp\.com|herokuapp\.com|onrender\.com)$/i

export function siteHost(siteUrl: string | null): string | null {
  if (!siteUrl) return null
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/** The domain he owns, or null for a hosting subdomain or no site. */
export function ownDomain(siteUrl: string | null): string | null {
  const host = siteHost(siteUrl)
  return host && !HOSTED.test(host) ? host : null
}

/** NAME=… lines of a .env.example; comments and blank lines are skipped. */
export function envExampleKeys(text: string): string[] {
  return [...new Set([...text.matchAll(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]))]
}

/** The names in `vercel env ls` output; the value column is never kept. */
export function vercelEnvNames(output: string): string[] {
  const names: string[] = []
  let table = false
  for (const line of output.split('\n')) {
    if (/^\s*name\s+value\s+/i.test(line)) {
      table = true
      continue
    }
    const m = table ? line.match(/^\s*([A-Z][A-Z0-9_]*)\s+\S/) : null
    if (m) names.push(m[1])
  }
  return [...new Set(names)]
}

export interface Raw {
  siteUrl: string | null
  /** MX hosts of the own domain; null when not looked up. */
  mx: string[] | null
  /** TXT records of the domain and of _dmarc.domain. */
  spf: boolean | null
  dmarc: boolean | null
  /** The homepage HTML, or null when it could not be read. */
  html: string | null
  /** Trustpilot's page for the domain: true found, false not found, null unknown. */
  trustpilot: boolean | null
  /** An app with this name in the App Store from him: its URL, '' when not found, null unknown. */
  appStore: string | null
  /** Socials linked in the cockpit. */
  socials: number
  /** Names in .env.example and in production; null when unknown. */
  example: string[] | null
  production: string[] | null
}

const row = (key: string, status: SetupRow['status'], note: string): SetupRow => ({ key, source: 'auto', status, note })

/** What the raw answers say, step by step; a step it cannot tell about is left out. */
export function detectSetup(raw: Raw): SetupRow[] {
  const out: SetupRow[] = []
  const host = siteHost(raw.siteUrl)
  const domain = ownDomain(raw.siteUrl)
  if (host) out.push(domain ? row('domain', 'done', domain) : row('domain', 'todo', `Nu op ${host}`))
  if (domain && raw.mx) out.push(raw.mx.length ? row('mail', 'done', `Mail via ${raw.mx[0].replace(/\.$/, '')}`) : row('mail', 'todo', `Geen mail op ${domain}`))
  if (domain && raw.spf !== null && raw.dmarc !== null) {
    const missing = [raw.spf ? null : 'SPF', raw.dmarc ? null : 'DMARC'].filter(Boolean)
    out.push(missing.length ? row('mail-auth', 'todo', `${missing.join(' en ')} ontbreekt`) : row('mail-auth', 'done', 'SPF en DMARC staan'))
  }
  if (raw.html !== null) {
    const html = raw.html.toLowerCase()
    out.push(/href="[^"]*(privacy|privacidad|privacybeleid|privacyverklaring|legal)[^"]*"/.test(html) ? row('privacy', 'done', 'Link gevonden op de homepage') : row('privacy', 'todo', 'Geen privacylink op de homepage'))
    const tool = /plausible\.io/.test(html) ? 'Plausible' : /_vercel\/insights|va\.vercel-scripts/.test(html) ? 'Vercel Analytics' : /googletagmanager|gtag\(/.test(html) ? 'Google Analytics' : null
    out.push(tool ? row('analytics', 'done', tool) : row('analytics', 'todo', 'Geen meetscript gevonden'))
    if (/name="google-site-verification"/.test(html)) out.push(row('search-console', 'done', 'Verificatie gevonden'))
  }
  if (domain && raw.trustpilot !== null) out.push(raw.trustpilot ? row('trustpilot', 'done', `trustpilot.com/review/${domain}`) : row('trustpilot', 'todo', 'Nog geen profiel'))
  if (raw.appStore !== null) out.push(raw.appStore ? row('app-store', 'done', raw.appStore) : row('app-store', 'todo', 'Niet gevonden in de App Store'))
  out.push(raw.socials ? row('socials', 'done', `${raw.socials} gekoppeld`) : row('socials', 'todo', 'Nog niets gekoppeld'))
  if (raw.example && raw.production) {
    const prod = new Set(raw.production)
    const missing = raw.example.filter((k) => !prod.has(k) && !/^(NEXT_PUBLIC_)?(DEBUG|TEST|E2E|CI|PORT|NODE_ENV)(_|$)|FAKE|LOCAL|DEV_/.test(k))
    out.push(missing.length ? row('env-keys', 'todo', `Ontbreekt in productie: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` en ${missing.length - 8} meer` : ''}`) : row('env-keys', 'done', 'Alles uit .env.example staat in productie'))
    const stripe = raw.example.filter((k) => /STRIPE.*SECRET/.test(k))
    if (stripe.length) {
      const set = stripe.filter((k) => prod.has(k))
      out.push(set.length ? row('stripe', 'unknown', 'Sleutel staat in productie; kijk in Stripe of het de live-sleutel is') : row('stripe', 'todo', `${stripe[0]} ontbreekt in productie`))
    }
    if ([...prod].some((k) => /SENTRY_DSN$/.test(k))) out.push(row('alerts', 'done', 'Sentry staat in productie'))
    const google = raw.example.filter((k) => /GOOGLE.*(CLIENT_ID|ID)$|AUTH_GOOGLE_ID/.test(k))
    if (google.length) out.push(google.some((k) => prod.has(k)) ? row('google-oauth', 'unknown', 'Sleutel staat in productie; is het toestemmingsscherm geverifieerd?') : row('google-oauth', 'todo', `${google[0]} ontbreekt in productie`))
  }
  return out
}
