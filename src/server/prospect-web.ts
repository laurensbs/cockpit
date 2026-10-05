import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { contactLinks, extractEmails, extractPhones, hostOf, pickBusinessEmail } from '@/lib/prospect'
import { normalizeUrl } from '@/lib/urls'
import { fixturesAllowed } from './status'

// The cockpit itself visits the site of a business Claude found, to read its public address and phone.
// Claude never handles them. Only http(s), never a local or private address, small pages, short time.

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 8000
const USER_AGENT = 'Mozilla/5.0 (Macintosh) Cockpit/1.0 (local business lookup)'

export interface SiteDetails {
  email: string | null
  emailSource: string | null
  phone: string | null
}

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./]

function isPrivate(address: string): boolean {
  if (isIP(address) === 4) return PRIVATE_V4.some((r) => r.test(address))
  const a = address.toLowerCase()
  return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80') || a.startsWith('::ffff:127.') || a.startsWith('::ffff:10.') || a.startsWith('::ffff:192.168.')
}

/** Whether the cockpit may fetch this address: a public web address on a public host. */
export async function isPublicUrl(raw: string): Promise<boolean> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password) return false
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (isIP(host)) return !isPrivate(host)
  try {
    const addresses = await lookup(host, { all: true })
    return addresses.length > 0 && addresses.every((a) => !isPrivate(a.address))
  } catch {
    return false
  }
}

async function getPage(url: string): Promise<string | null> {
  if (!(await isPublicUrl(url))) return null
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' } })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null
    if (res.url && res.url !== url && !(await isPublicUrl(res.url))) return null
    const reader = res.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) {
        await reader.cancel()
        break
      }
      chunks.push(value)
    }
    return new TextDecoder().decode(Buffer.concat(chunks))
  } catch {
    return null
  }
}

/** Fixed answers for the tests: every *.example site lists info@ and a phone number. */
function fixtureDetails(site: string): SiteDetails {
  const host = hostOf(site)
  if (host.startsWith('nomail.')) return { email: null, emailSource: null, phone: '+34972000000' }
  return { email: `info@${host}`, emailSource: `${site}/contact`, phone: '+34972000000' }
}

/** The public business address and phone of a site: the home page and up to three contact pages. */
export async function findSiteDetails(website: string): Promise<SiteDetails> {
  const site = normalizeUrl(website)
  if (!site) return { email: null, emailSource: null, phone: null }
  if (fixturesAllowed() && process.env.COCKPIT_FAKE_WEB === '1') return fixtureDetails(site)
  const home = await getPage(site)
  if (home == null) return { email: null, emailSource: null, phone: null }
  const pages: { url: string; html: string }[] = [{ url: site, html: home }]
  for (const link of contactLinks(home, site)) {
    const html = await getPage(link)
    if (html) pages.push({ url: link, html })
  }
  const emails = pages.flatMap((p) => extractEmails(p.html).map((email) => ({ email, source: p.url })))
  const picked = pickBusinessEmail(emails, site)
  const phone = pages.map((p) => extractPhones(p.html)[0]).find(Boolean) ?? null
  return { email: picked?.email ?? null, emailSource: picked?.source ?? null, phone }
}
