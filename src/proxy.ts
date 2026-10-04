import { NextResponse, type NextRequest } from 'next/server'
import { contentSecurityPolicy, newNonce } from '@/lib/csp'
import { expectedToken, isLoopbackHost, TOKEN_COOKIE, tokenMatches } from '@/lib/local'

const LOCKED = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Cockpit</title></head>
<body style="font:16px/1.5 system-ui,sans-serif;padding:3rem 1.5rem;max-width:32rem;margin:auto;color:#1a1c33;background:#f3f4fa">
<h1 style="font-size:1.4rem">Cockpit</h1>
<p>Deze pagina hoort bij de Cockpit-app op deze computer. Open de app zelf: die kent de toegangscode.</p>
</body></html>`

/**
 * The cockpit answers only its own app window. Three checks, in order: the request must come in on a
 * loopback name (no DNS rebinding), the server must have been started with a token, and a page is
 * served only with that token in the cookie. API routes check the token themselves (cookie or bearer).
 */
export function proxy(request: NextRequest) {
  if (!isLoopbackHost(request.headers.get('host'))) return new NextResponse('Forbidden', { status: 403 })
  const token = expectedToken()
  if (!token) return new NextResponse('De cockpit is zonder toegangscode gestart.', { status: 503 })
  const { pathname } = request.nextUrl
  if (pathname === '/auth' || pathname.startsWith('/api/')) return NextResponse.next()
  if (!tokenMatches(request.cookies.get(TOKEN_COOKIE)?.value, token)) {
    return new NextResponse(LOCKED, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  // Every page gets its own nonce; Next.js reads it from the request's policy and puts it on its scripts.
  const policy = contentSecurityPolicy(newNonce(), { dev: process.env.NODE_ENV === 'development', https: false })
  const headers = new Headers(request.headers)
  headers.set('Content-Security-Policy', policy)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('Content-Security-Policy', policy)
  return response
}

export const config = {
  // Everything but Next's own static files and the icons.
  matcher: ['/((?!_next/|favicon|icon-|icon\\.svg|apple-touch-icon).*)'],
}
