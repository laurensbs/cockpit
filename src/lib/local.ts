import { timingSafeEqual } from 'node:crypto'

/** The cookie that tells the local server a request comes from the app window (or a browser that was given the token). */
export const TOKEN_COOKIE = 'cockpit'

/** The token the app was started with. Outside production a fixed one, so `npm run dev` just works. */
export function expectedToken(env: { COCKPIT_TOKEN?: string; NODE_ENV?: string } = process.env): string | null {
  const token = env.COCKPIT_TOKEN?.trim()
  if (token) return token
  return env.NODE_ENV === 'production' ? null : 'dev'
}

/** Constant-time comparison; false for anything that is not a non-empty string. */
export function tokenMatches(given: unknown, expected: string | null): boolean {
  if (typeof given !== 'string' || !given || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Only the loopback names. A web page cannot talk to the cockpit through a hostname of its own that
 * points at 127.0.0.1 (DNS rebinding): the Host header gives it away.
 */
export function isLoopbackHost(host: string | null): boolean {
  if (!host) return false
  const h = host.trim().toLowerCase()
  const name = h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.replace(/:\d+$/, '')
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]'
}
