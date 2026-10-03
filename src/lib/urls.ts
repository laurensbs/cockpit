/** An http(s) address as typed ("rondje.nl", "https://x.dev/"), or null when it is not one. */
export function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

/** owner/name as GitHub allows it; never "." or ".." as a name, which would change the API path. */
export const REPO_NAME = /^[A-Za-z0-9-]{1,39}\/(?!\.\.?$)[A-Za-z0-9._-]{1,100}$/

/** The host of an address, for showing it short: "rondje-five.vercel.app". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
