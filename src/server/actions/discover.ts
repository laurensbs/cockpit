'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { PLAUSIBLE_KEY_SETTING } from '../connectors/plausible'
import { pullAll } from '../connectors/run'
import { discoverAll, undoFound } from '../discover'
import { actionOwner } from '../session'
import { setSetting } from '../settings'
import { VERCEL_TOKEN_SETTING } from '../vercel'
import type { FormState } from './types'

// The owner-wide keys that let the cockpit link projects by itself, and the buttons to look again.

/** Look for every project (or one) now, and pull what got linked, so the numbers come right away. */
async function lookAndPull(ownerId: string, projectId?: string) {
  const db = await getDb()
  const run = await discoverAll(db, ownerId, { projectId, force: true })
  if (run.linked) await pullAll(db, ownerId, { projectId, force: true })
  return run
}

const linkedText = (n: number) => (n ? `${n} ${n === 1 ? 'koppeling' : 'koppelingen'} gelegd.` : 'Niets nieuws gevonden.')

export async function saveVercelToken(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const db = await getDb()
  if (form.get('remove') === '1') {
    await setSetting(db, owner.userId, VERCEL_TOKEN_SETTING, null)
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Vercel-token verwijderd.' }
  }
  const token = String(form.get('token') ?? '').trim()
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return { ok: false, error: 'Dat lijkt geen Vercel-token. Maak er een onder vercel.com → Account Settings → Tokens.' }
  await setSetting(db, owner.userId, VERCEL_TOKEN_SETTING, token)
  const run = await lookAndPull(owner.userId)
  revalidatePath('/', 'layout')
  return { ok: true, message: `Bewaard. ${linkedText(run.linked)}` }
}

export async function savePlausibleKey(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const db = await getDb()
  if (form.get('remove') === '1') {
    await setSetting(db, owner.userId, PLAUSIBLE_KEY_SETTING, null)
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Plausible-sleutel verwijderd.' }
  }
  const key = String(form.get('key') ?? '').trim()
  if (key.length < 16 || key.length > 200 || /\s/.test(key)) return { ok: false, error: 'Een Plausible-sleutel is langer (Plausible → Account → API keys → Stats API).' }
  await setSetting(db, owner.userId, PLAUSIBLE_KEY_SETTING, key)
  const run = await lookAndPull(owner.userId)
  revalidatePath('/', 'layout')
  return { ok: true, message: `Bewaard. ${linkedText(run.linked)}` }
}

/** "Zoek koppelingen": for one project, or for all of them. */
export async function discoverNow(projectId?: string): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  if (projectId) {
    const db = await getDb()
    const [own] = await db
      .select({ id: s.project.id })
      .from(s.project)
      .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
    if (!own) return { ok: false, message: 'Dat project bestaat niet.' }
  }
  const run = await lookAndPull(owner.userId, projectId ? String(projectId) : undefined)
  revalidatePath('/', 'layout')
  return { ok: true, message: linkedText(run.linked) }
}

/** "Ongedaan maken" on something the cockpit linked by itself. */
export async function undoDiscovered(projectId: string, kind: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [own] = await db
    .select({ id: s.project.id })
    .from(s.project)
    .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
  if (!own) return
  await undoFound(db, owner.userId, own.id, String(kind))
  revalidatePath(`/projects/${own.id}`)
  revalidatePath(`/projects/${own.id}/numbers`)
}
