import 'server-only'
import type { Db } from '@/db'
import { getSetting, setSetting } from '../settings'

// The accounts the cockpit publishes to, on his computer only: the developer apps he made (LinkedIn,
// TikTok), the tokens from logging in, and the Vercel Blob store Instagram fetches files from. Only
// names and dates ever go to a page; tokens never.

export interface LinkedinApp {
  clientId: string
  clientSecret: string
}
export interface LinkedinAccount {
  token: string
  sub: string
  name: string
  expiresAt: string
}
export interface InstagramAccount {
  token: string
  userId: string
  username: string
  /** Long-lived tokens last 60 days; the cockpit refreshes them along the way. */
  expiresAt: string
  refreshedAt: string
}
export interface TiktokApp {
  clientKey: string
  clientSecret: string
}
export interface TiktokAccount {
  accessToken: string
  refreshToken: string
  openId: string
  name: string
  expiresAt: string
  refreshExpiresAt: string
}

const KEYS = {
  linkedinApp: 'linkedin_app',
  linkedin: 'linkedin_account',
  tiktokApp: 'tiktok_app',
  blob: 'blob_token',
  instagram: (projectId: string) => `instagram:${projectId}`,
  tiktok: (projectId: string) => `tiktok:${projectId}`,
}

async function readJson<T>(db: Db, ownerId: string, key: string): Promise<T | null> {
  const raw = await getSetting(db, ownerId, key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
const writeJson = (db: Db, ownerId: string, key: string, value: unknown) => setSetting(db, ownerId, key, value == null ? null : JSON.stringify(value))

export const accounts = {
  linkedinApp: (db: Db, o: string) => readJson<LinkedinApp>(db, o, KEYS.linkedinApp),
  setLinkedinApp: (db: Db, o: string, v: LinkedinApp | null) => writeJson(db, o, KEYS.linkedinApp, v),
  linkedin: (db: Db, o: string) => readJson<LinkedinAccount>(db, o, KEYS.linkedin),
  setLinkedin: (db: Db, o: string, v: LinkedinAccount | null) => writeJson(db, o, KEYS.linkedin, v),
  tiktokApp: (db: Db, o: string) => readJson<TiktokApp>(db, o, KEYS.tiktokApp),
  setTiktokApp: (db: Db, o: string, v: TiktokApp | null) => writeJson(db, o, KEYS.tiktokApp, v),
  instagram: (db: Db, o: string, projectId: string) => readJson<InstagramAccount>(db, o, KEYS.instagram(projectId)),
  setInstagram: (db: Db, o: string, projectId: string, v: InstagramAccount | null) => writeJson(db, o, KEYS.instagram(projectId), v),
  tiktok: (db: Db, o: string, projectId: string) => readJson<TiktokAccount>(db, o, KEYS.tiktok(projectId)),
  setTiktok: (db: Db, o: string, projectId: string, v: TiktokAccount | null) => writeJson(db, o, KEYS.tiktok(projectId), v),
  blobToken: (db: Db, o: string) => getSetting(db, o, KEYS.blob),
  setBlobToken: (db: Db, o: string, v: string | null) => setSetting(db, o, KEYS.blob, v),
}

/** Is a channel ready to publish for a project? */
export async function channelReady(db: Db, ownerId: string, channel: string, projectId: string | null): Promise<boolean> {
  if (channel === 'linkedin') {
    const a = await accounts.linkedin(db, ownerId)
    return Boolean(a && Date.parse(a.expiresAt) > Date.now())
  }
  if (!projectId) return false
  if (channel === 'instagram') return Boolean((await accounts.instagram(db, ownerId, projectId)) && (await accounts.blobToken(db, ownerId)))
  if (channel === 'tiktok') {
    const a = await accounts.tiktok(db, ownerId, projectId)
    return Boolean(a && Date.parse(a.refreshExpiresAt) > Date.now())
  }
  return false
}

/** A fingerprint of who is connected (names and dates, no tokens): the page sees a new login by it. */
export async function connectionStamp(db: Db, ownerId: string, projectIds: string[]): Promise<string> {
  const li = await accounts.linkedin(db, ownerId)
  const tt = await Promise.all(projectIds.map(async (id) => (await accounts.tiktok(db, ownerId, id))?.refreshExpiresAt ?? ''))
  return JSON.stringify([li?.expiresAt ?? '', ...tt])
}
