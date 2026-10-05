'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { setupItem, type SetupStatus } from '@/lib/setup'
import { actionOwner } from '../session'
import { checkSetup, setOwnStatus } from '../setup-check'
import { award } from '../xp'

async function ownProject(projectId: string, ownerId: string) {
  const [p] = await (await getDb()).select({ id: s.project.id }).from(s.project).where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, ownerId)))
  return p ?? null
}

/** He says a step is done, not needed, or takes his word back (null). Done is worth a little XP. */
export async function setSetupStatus(projectId: string, key: string, status: SetupStatus | null): Promise<{ ok: boolean; xp: number }> {
  const owner = await actionOwner()
  if (!setupItem(key) || !(await ownProject(projectId, owner.userId))) return { ok: false, xp: 0 }
  const db = await getDb()
  await setOwnStatus(db, owner.userId, projectId, key, status)
  const xp = status === 'done' ? await award(db, owner.userId, { kind: 'quest', refId: `setup:${projectId}:${key}`, projectId, xp: 25 }) : 0
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
  return { ok: true, xp }
}

/** Looks again now: DNS, the site, Trustpilot, the App Store, the keys in production. */
export async function recheckSetup(projectId: string): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  if (!(await ownProject(projectId, owner.userId))) return { ok: false, message: 'Dat project bestaat niet.' }
  await checkSetup(await getDb(), owner.userId, projectId)
  revalidatePath(`/projects/${projectId}`)
  return { ok: true, message: 'Opnieuw gecontroleerd.' }
}
