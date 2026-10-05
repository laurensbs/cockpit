import 'server-only'
import { and, eq, like } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { accounts, type InstagramAccount } from './accounts'
import { callJson } from './http'

/**
 * Instagram's long-lived tokens last 60 days and can be renewed once they are a day old: the daily
 * round renews each one weekly, so it never runs out while the app is used.
 */
export async function refreshInstagramTokens(db: Db, ownerId: string, now = new Date()): Promise<number> {
  const rows = await db
    .select({ key: s.setting.key })
    .from(s.setting)
    .where(and(eq(s.setting.ownerId, ownerId), like(s.setting.key, 'instagram:%')))
  let renewed = 0
  for (const { key } of rows) {
    const projectId = key.slice('instagram:'.length)
    const account = await accounts.instagram(db, ownerId, projectId)
    if (!account) continue
    const age = now.getTime() - Date.parse(account.refreshedAt)
    if (age < 7 * 86_400_000 || Date.parse(account.expiresAt) <= now.getTime()) continue
    try {
      const r = await callJson<{ access_token?: string; expires_in?: number }>('Instagram', `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: account.token })}`)
      if (!r.access_token) continue
      const next: InstagramAccount = { ...account, token: r.access_token, refreshedAt: now.toISOString(), expiresAt: new Date(now.getTime() + (r.expires_in ?? 60 * 86_400) * 1000).toISOString() }
      await accounts.setInstagram(db, ownerId, projectId, next)
      renewed++
    } catch {
      // Tried again tomorrow; the page shows when a token is close to its end.
    }
  }
  return renewed
}
