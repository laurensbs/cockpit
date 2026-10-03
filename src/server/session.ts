import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getDb } from '@/db'
import { auth } from '@/lib/auth'
import { isOwnerEmail } from '@/lib/owner'
import { ownerEmails } from '@/lib/site'

export interface Owner {
  userId: string
  email: string
  name: string
}

export const getSession = cache(async () => {
  await getDb()
  return auth.api.getSession({ headers: await headers() })
})

/** The signed-in owner. Someone removed from OWNER_EMAILS loses access at once. */
export const getOwner = cache(async (): Promise<Owner | null> => {
  const session = await getSession()
  if (!session || !isOwnerEmail(session.user.email, ownerEmails())) return null
  return { userId: session.user.id, email: session.user.email, name: session.user.name }
})

export async function requireOwner(next = '/'): Promise<Owner> {
  const owner = await getOwner()
  if (!owner) redirect(`/login?next=${encodeURIComponent(next)}`)
  return owner
}

/** For server actions and route handlers: fails instead of redirecting. */
export async function actionOwner(): Promise<Owner> {
  const owner = await getOwner()
  if (!owner) throw new Error('unauthorized')
  return owner
}
