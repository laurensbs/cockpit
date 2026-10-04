import { NextResponse, type NextRequest } from 'next/server'
import { expectedToken, TOKEN_COOKIE, tokenMatches } from '@/lib/local'
import { safeNext } from '@/lib/site'

export const dynamic = 'force-dynamic'

/** A browser opens this once with the token (the app window gets its cookie directly); the cookie lets every later request in. */
export function GET(request: NextRequest) {
  const token = expectedToken()
  if (!token || !tokenMatches(request.nextUrl.searchParams.get('token'), token)) return new NextResponse('Forbidden', { status: 403 })
  const response = NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get('next')), request.nextUrl.origin))
  response.cookies.set(TOKEN_COOKIE, token, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 365 })
  return response
}
