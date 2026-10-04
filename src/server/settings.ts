import 'server-only'
import { and, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { fixturesAllowed } from './status'

/** One value per key per owner: the name, the GitHub token, what is connected. */
export async function getSetting(db: Db, ownerId: string, key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: s.setting.value })
    .from(s.setting)
    .where(and(eq(s.setting.ownerId, ownerId), eq(s.setting.key, key)))
  return row?.value ?? null
}

/** Stores a value; an empty value removes the key. */
export async function setSetting(db: Db, ownerId: string, key: string, value: string | null): Promise<void> {
  if (!value) {
    await db.delete(s.setting).where(and(eq(s.setting.ownerId, ownerId), eq(s.setting.key, key)))
    return
  }
  await db
    .insert(s.setting)
    .values({ id: crypto.randomUUID(), ownerId, key, value })
    .onConflictDoUpdate({ target: [s.setting.ownerId, s.setting.key], set: { value, updatedAt: new Date() } })
}

let ghCache: { at: number; token: string | null } | null = null

/** The token of the GitHub CLI (`gh auth login`), when it is installed and signed in. Looked up once every five minutes. */
async function ghToken(): Promise<string | null> {
  if (ghCache && Date.now() - ghCache.at < 300_000) return ghCache.token
  const { exec } = await import('node:child_process')
  const token = await new Promise<string | null>((resolve) =>
    exec('gh auth token', { timeout: 5_000, windowsHide: true }, (error, stdout) => {
      const t = stdout.trim()
      resolve(!error && /^(gh[opsu]_|github_pat_)[A-Za-z0-9_]+$/.test(t) ? t : null)
    }),
  )
  ghCache = { at: Date.now(), token }
  return token
}

/** Where the GitHub token comes from: the settings, the GitHub CLI, or (while developing) the environment. */
export async function githubTokenSource(db: Db, ownerId: string): Promise<{ token: string | null; from: 'settings' | 'gh' | 'env' | null }> {
  const stored = await getSetting(db, ownerId, 'github_token')
  if (stored) return { token: stored, from: 'settings' }
  if (fixturesAllowed() && process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN, from: 'env' }
  if (process.env.COCKPIT_NO_GH !== '1') {
    const gh = await ghToken()
    if (gh) return { token: gh, from: 'gh' }
  }
  return { token: null, from: null }
}

export async function githubToken(db: Db, ownerId: string): Promise<string | null> {
  return (await githubTokenSource(db, ownerId)).token
}
