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

/** The GitHub token from the settings; while developing, GITHUB_TOKEN from the environment will do too. */
export async function githubToken(db: Db, ownerId: string): Promise<string | null> {
  return (await getSetting(db, ownerId, 'github_token')) ?? (fixturesAllowed() ? process.env.GITHUB_TOKEN : undefined) ?? null
}
