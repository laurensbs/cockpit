/** The public base URL of this deployment, without a trailing slash. */
export function siteUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

/** Every origin that may call the auth API: production, this deployment, branch previews, local. */
export function trustedOrigins(): string[] {
  const hosts = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean)
  return [siteUrl(), ...hosts.map((h) => `https://${h}`), 'http://localhost:3000', `http://localhost:${process.env.PORT ?? 3000}`]
}

/** The addresses that may use the cockpit (OWNER_EMAILS, comma separated). */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

const SAME_SITE = 'https://same-site.invalid'

/** Only allow redirects to paths on this site: never "//evil", "/\evil" or control characters. */
export function safeNext(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return fallback
  }
  try {
    return new URL(value, SAME_SITE).origin === SAME_SITE ? value : fallback
  } catch {
    return fallback
  }
}

export const APP_NAME = 'Cockpit'
