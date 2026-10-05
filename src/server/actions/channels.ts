'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { accounts, connectionStamp } from '../publish/accounts'
import { instagramAccount, linkedinLoginUrl, tiktokLoginUrl } from '../publish/oauth'
import { scheduleApproved } from '../publish/run'
import { actionOwner } from '../session'
import { setSetting } from '../settings'
import type { FormState } from './types'

// Settings → Kanalen: the developer apps he made, logging in, the Instagram tokens and the Blob store.
// Secrets are written, never read back to a page; an empty secret field keeps the stored one.

const refresh = () => {
  revalidatePath('/settings')
  revalidatePath('/content')
}

/** The port the cockpit answers on, from the request: the address LinkedIn and TikTok send him back to. */
async function port(): Promise<string> {
  const host = (await headers()).get('host') ?? ''
  return host.match(/:(\d+)$/)?.[1] ?? process.env.PORT ?? '41414'
}

const field = (form: FormData, name: string, max = 200) =>
  String(form.get(name) ?? '')
    .trim()
    .slice(0, max)

export async function saveLinkedinApp(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const db = await getDb()
  const old = await accounts.linkedinApp(db, owner.userId)
  const clientId = field(form, 'clientId')
  const clientSecret = field(form, 'clientSecret') || old?.clientSecret || ''
  if (!/^[A-Za-z0-9]{8,40}$/.test(clientId)) return { ok: false, error: 'De Client ID staat onder Auth in je LinkedIn-app (letters en cijfers).' }
  if (clientSecret.length < 8) return { ok: false, error: 'Vul het Client Secret in (Auth → Primary Client Secret).' }
  await accounts.setLinkedinApp(db, owner.userId, { clientId, clientSecret })
  refresh()
  return { ok: true, message: 'Bewaard. Druk nu op Koppel LinkedIn.' }
}

export async function linkedinLogin(): Promise<{ url?: string; error?: string }> {
  const owner = await actionOwner()
  const url = await linkedinLoginUrl(await getDb(), owner.userId, await port())
  return typeof url === 'string' ? { url } : url
}

export async function disconnectLinkedin(): Promise<void> {
  const owner = await actionOwner()
  await accounts.setLinkedin(await getDb(), owner.userId, null)
  refresh()
}

async function ownProject(ownerId: string, projectId: string) {
  const db = await getDb()
  const [p] = await db
    .select({ id: s.project.id })
    .from(s.project)
    .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, ownerId)))
  return p ? db : null
}

export async function saveInstagram(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const projectId = field(form, 'projectId', 64)
  const db = await ownProject(owner.userId, projectId)
  if (!db) return { ok: false, error: 'Kies een project.' }
  const token = field(form, 'token', 600)
  if (token.length < 30) return { ok: false, error: 'Plak het toegangstoken uit je Meta-app (API setup with Instagram login → Generate token).' }
  const found = await instagramAccount(token)
  if ('error' in found) return { ok: false, error: found.error }
  const now = new Date()
  await accounts.setInstagram(db, owner.userId, projectId, { token, userId: found.userId, username: found.username, refreshedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 60 * 86_400_000).toISOString() })
  await scheduleApproved(db, owner.userId)
  refresh()
  return { ok: true, message: `Gekoppeld: @${found.username || found.userId}.` }
}

export async function removeInstagram(projectId: string): Promise<void> {
  const owner = await actionOwner()
  await accounts.setInstagram(await getDb(), owner.userId, String(projectId), null)
  refresh()
}

export async function saveBlobToken(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const token = field(form, 'token', 300)
  if (!/^vercel_blob_rw_[A-Za-z0-9_]{10,}$/.test(token)) return { ok: false, error: 'Een Blob-token begint met vercel_blob_rw_ (Vercel → Storage → je Blob-store → .env.local).' }
  const db = await getDb()
  await accounts.setBlobToken(db, owner.userId, token)
  await scheduleApproved(db, owner.userId)
  refresh()
  return { ok: true, message: 'Bewaard.' }
}

export async function removeBlobToken(): Promise<void> {
  const owner = await actionOwner()
  await accounts.setBlobToken(await getDb(), owner.userId, null)
  refresh()
}

export async function saveTiktokApp(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const db = await getDb()
  const old = await accounts.tiktokApp(db, owner.userId)
  const clientKey = field(form, 'clientKey')
  const clientSecret = field(form, 'clientSecret') || old?.clientSecret || ''
  if (!/^[A-Za-z0-9]{8,40}$/.test(clientKey)) return { ok: false, error: 'De Client key staat in je TikTok-app onder App details.' }
  if (clientSecret.length < 8) return { ok: false, error: 'Vul het Client secret in.' }
  await accounts.setTiktokApp(db, owner.userId, { clientKey, clientSecret })
  refresh()
  return { ok: true, message: 'Bewaard. Koppel nu per project je TikTok-account.' }
}

export async function tiktokLogin(projectId: string): Promise<{ url?: string; error?: string }> {
  const owner = await actionOwner()
  const db = await ownProject(owner.userId, String(projectId))
  if (!db) return { error: 'Kies een project.' }
  const url = await tiktokLoginUrl(db, owner.userId, String(projectId), await port())
  return typeof url === 'string' ? { url } : url
}

export async function removeTiktok(projectId: string): Promise<void> {
  const owner = await actionOwner()
  await accounts.setTiktok(await getDb(), owner.userId, String(projectId), null)
  refresh()
}

/** The emergency stop: nothing goes out while it is on. */
export async function setPublishPaused(paused: boolean): Promise<void> {
  const owner = await actionOwner()
  await setSetting(await getDb(), owner.userId, 'publish_paused', paused ? '1' : null)
  refresh()
}

/** After a login in his browser: the connection fingerprint (no tokens); approved posts get their jobs. */
export async function connectionNow(): Promise<string> {
  const owner = await actionOwner()
  const db = await getDb()
  await scheduleApproved(db, owner.userId)
  const projects = await db.select({ id: s.project.id }).from(s.project).where(eq(s.project.ownerId, owner.userId))
  return connectionStamp(db, owner.userId, projects.map((p) => p.id))
}
