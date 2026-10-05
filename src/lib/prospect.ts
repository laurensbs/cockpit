import { EMAIL } from './mailto'

// Finding the public address of a business on its own website, pure so it can be tested. The server
// fetches the pages (src/server/prospect-email.ts); this decides which links to follow and which
// address to keep. Claude never sees the address: it stays in the cockpit.

/** Addresses a business puts on its site for anyone to use, in the languages of his markets. */
const ROLE = /^(info|contact|contacto|contacte|kontakt|hola|hello|hallo|hi|mail|office|oficina|admin|administracion|administratie|ventas|sales|verkoop|taller|werkplaats|service|servicio|servei|reservas|reservations|booking|boekingen|klantenservice|support|soporte|recepcion|receptie|tienda|shop|winkel|webdesign|web|studio|team|bureau)([.\-_]?[a-z]*)?$/i

const FREE_MAIL = /@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|telefonica|movistar|ziggo|kpnmail|kpnplanet|planet)\.[a-z.]+$/i

/** Pages worth a look for an address, by their link text or path, in nl, es, ca, en, de, fr. */
const CONTACT_LINK = /contact|contacto|contacte|kontakt|contactez|over-ons|about|sobre|quienes|qui-som|aviso-legal|avis-legal|legal|impressum|colofon/i

/** Every address on a page: mailto links first, then plain text (also "info [at] site.com"). */
export function extractEmails(html: string): string[] {
  const found = new Set<string>()
  const decoded = html.replace(/&#64;|&commat;/gi, '@').replace(/&#46;|&period;/gi, '.')
  for (const m of decoded.matchAll(/mailto:([^"'?\s>]+)/gi)) found.add(decodeURIComponent(m[1]).trim().toLowerCase())
  const text = decoded.replace(/\s*[[(]\s*(at|arroba)\s*[\])]\s*/gi, '@').replace(/\s*[[(]\s*(dot|punto)\s*[\])]\s*/gi, '.')
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) found.add(m[0].toLowerCase())
  return [...found].filter((e) => EMAIL.test(e) && !/\.(png|jpe?g|gif|webp|svg)$/i.test(e) && !/(example|sentry|wixpress|domain)\./i.test(e))
}

/** Links on the home page that probably lead to the contact details, same site only, at most three. */
export function contactLinks(html: string, base: string): string[] {
  const out: string[] = []
  const host = hostOf(base)
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, label] = m
    if (href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue
    if (!CONTACT_LINK.test(href) && !CONTACT_LINK.test(label.replace(/<[^>]+>/g, ''))) continue
    let url: URL
    try {
      url = new URL(href, base)
    } catch {
      continue
    }
    if (!/^https?:$/.test(url.protocol) || hostOf(url.href) !== host) continue
    url.hash = ''
    if (!out.includes(url.href)) out.push(url.href)
    if (out.length === 3) break
  }
  return out
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/**
 * The address to keep: a role address on their own domain first, then any address on their domain,
 * then a role address at a free mail provider that the site itself shows (small firms use Gmail).
 * Never an address of someone else's domain (their web agency, a platform).
 */
export function pickBusinessEmail(found: { email: string; source: string }[], site: string): { email: string; source: string } | null {
  const host = hostOf(site)
  const domainOf = (e: string) => e.split('@')[1] ?? ''
  const sameSite = (e: string) => {
    const d = domainOf(e)
    return d === host || host.endsWith(`.${d}`) || d.endsWith(`.${host}`)
  }
  const local = (e: string) => e.split('@')[0] ?? ''
  const ranked = [
    found.filter((f) => sameSite(f.email) && ROLE.test(local(f.email))),
    found.filter((f) => sameSite(f.email)),
    found.filter((f) => FREE_MAIL.test(f.email) && (ROLE.test(local(f.email)) || local(f.email).includes(host.split('.')[0]))),
  ]
  for (const group of ranked) if (group.length) return group[0]
  return null
}

/**
 * Business phone numbers on a page: tel: links first, then a number written right after a word like
 * "tel", "teléfono", "telefoon", "móvil" or "WhatsApp" (so prices, postcodes and dates never count).
 */
export function extractPhones(html: string): string[] {
  const found: string[] = []
  const add = (raw: string) => {
    const phone = normalizePhone(raw)
    if (phone && !found.includes(phone)) found.push(phone)
  }
  for (const m of html.matchAll(/(?:tel|callto):([+\d\s().%20-]{6,})/gi)) add(decodeURIComponent(m[1]))
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  for (const m of text.matchAll(/(?:tel[eéè]?(?:f(?:o|oo)n(?:o)?)?|telf|tlf|phone|m[oó]vil|mobiel|whatsapp|bel ons)\.?\s*[:.]?\s*((?:\+|00)?[\d][\d\s().-]{7,16}\d)/gi)) add(m[1])
  return found
}

/** Digits with an optional +, 9 to 13 of them; anything else is not a phone number. */
export function normalizePhone(raw: string): string | null {
  const phone = raw.trim().replace(/[^\d+]/g, '').replace(/^00/, '+')
  const digits = phone.replace(/\D/g, '').length
  return digits >= 9 && digits <= 13 && !phone.slice(1).includes('+') ? phone : null
}

/** One business, one entry: the same name or the same website counts as known. */
export function prospectKey(organization: string, website: string | null | undefined): string[] {
  const keys = [`org:${organization.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()}`]
  const host = website ? hostOf(website) : ''
  if (host) keys.push(`host:${host}`)
  return keys
}
