import { NextResponse, type NextRequest } from 'next/server'
import { contentSecurityPolicy, newNonce } from '@/lib/csp'

/**
 * Production answers on several hostnames (the project domain, the team alias, the
 * branch alias). Logins, cookies and passkeys are tied to one origin, so every
 * page request on another production hostname is sent to the canonical one.
 */
function canonicalRedirect(request: NextRequest): NextResponse | null {
  if (process.env.VERCEL_ENV !== 'production') return null
  const explicit = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL
  const canonical = explicit ? new URL(explicit).host : process.env.VERCEL_PROJECT_PRODUCTION_URL
  const host = request.headers.get('host')
  if (!canonical || !host || host === canonical) return null
  const url = request.nextUrl.clone()
  url.host = canonical
  url.protocol = 'https'
  url.port = ''
  return NextResponse.redirect(url, 308)
}

export function proxy(request: NextRequest) {
  const redirect = canonicalRedirect(request)
  if (redirect) return redirect
  // Every page gets its own nonce; Next.js reads it from the request's policy and puts it on its scripts.
  const policy = contentSecurityPolicy(newNonce(), { dev: process.env.NODE_ENV === 'development', https: Boolean(process.env.VERCEL) })
  const headers = new Headers(request.headers)
  headers.set('Content-Security-Policy', policy)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', policy)
  return response
}

export const config = {
  // Pages only: API routes (auth, cron, polling) answer on any hostname.
  matcher: ['/((?!api/|_next/|favicon|icon-|apple-touch-icon|og\\.png|manifest).*)'],
}
