import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getDb } from '@/db'
import { expectedToken, TOKEN_COOKIE, tokenMatches } from '@/lib/local'
import { getSetting } from './settings'

export interface Owner {
  userId: string
  email: string
  name: string
}

/** The one owner of this cockpit. Every row still carries an owner_id, so more people can follow later. */
export const LOCAL_OWNER_ID = 'local'

const owner = (name = ''): Owner => ({ userId: LOCAL_OWNER_ID, email: '', name })

/** The owner, when the request carries the app's token in its cookie; null for anything else. */
export const getOwner = cache(async (): Promise<Owner | null> => {
  const jar = await cookies()
  if (!tokenMatches(jar.get(TOKEN_COOKIE)?.value, expectedToken())) return null
  const db = await getDb()
  return owner((await getSetting(db, LOCAL_OWNER_ID, 'name')) ?? '')
})

/** Pages: the proxy already turned strangers away; this is the belt to its braces. */
export async function requireOwner(next = '/'): Promise<Owner> {
  const found = await getOwner()
  if (!found) redirect(`/auth?next=${encodeURIComponent(next)}`)
  return found
}

/** For server actions and route handlers: fails instead of redirecting. */
export async function actionOwner(): Promise<Owner> {
  const found = await getOwner()
  if (!found) throw new Error('unauthorized')
  return found
}

/** Route handlers may also be called with "Authorization: Bearer <token>", the way Claude Code's MCP client does. */
export function bearerOwner(request: Request): Owner | null {
  const header = request.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  return tokenMatches(given, expectedToken()) ? owner() : null
}
