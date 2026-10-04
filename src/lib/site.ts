/** Where the local server answers, without a trailing slash. */
export function siteUrl(): string {
  return `http://127.0.0.1:${process.env.PORT ?? 3000}`
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
