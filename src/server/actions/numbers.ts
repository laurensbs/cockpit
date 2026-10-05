'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { parseServiceAccount } from '@/lib/google-jwt'
import { METRIC_KEYS, normalizePoints } from '@/lib/metrics'
import { connectorKind, connectorSecretKey } from '../connectors'
import { GOOGLE_ACCOUNT_SETTING } from '../connectors/google'
import { pullAll, pullConnector } from '../connectors/run'
import { rollupMonths, upsertPoints } from '../points'
import { actionOwner } from '../session'
import { setSetting } from '../settings'
import { award } from '../xp'
import type { FormState } from './types'

async function ownProject(ownerId: string, projectId: string) {
  const db = await getDb()
  const [project] = await db
    .select({ id: s.project.id })
    .from(s.project)
    .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, ownerId)))
  return project ? { db, project } : null
}

const refresh = (projectId: string) => {
  revalidatePath(`/projects/${projectId}/numbers`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/')
}

const pointSchema = z.object({
  projectId: z.string().min(1).max(64),
  key: z.enum(METRIC_KEYS),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.coerce.number().min(-1e9).max(1e9),
})

/** One number on one day, typed in by him: it wins over every source for that day. */
export async function savePoint(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = pointSchema.safeParse({
    projectId: form.get('projectId'),
    key: form.get('key'),
    day: form.get('day') || dayOf(new Date()),
    value: String(form.get('value') ?? '')
      .replace(/[€\s]/g, '')
      .replace(',', '.'),
  })
  if (!parsed.success) return { ok: false, error: 'Kies een cijfer, een dag en een getal.' }
  const p = parsed.data
  const own = await ownProject(owner.userId, p.projectId)
  if (!own) return { ok: false, error: 'Dat project bestaat niet.' }
  const { ok, rejected } = normalizePoints([{ key: p.key, day: p.day, value: p.value }], dayOf(new Date()))
  if (!ok.length) return { ok: false, error: `Dat kan niet: ${rejected[0]?.why ?? 'ongeldig'}.` }
  await upsertPoints(own.db, owner.userId, p.projectId, 'manual', ok)
  await rollupMonths(own.db, owner.userId, p.projectId, [p.key])
  const xp = await award(own.db, owner.userId, { kind: 'metric', refId: `${p.projectId}:${p.day}:${p.key}`, projectId: p.projectId })
  refresh(p.projectId)
  return { ok: true, message: xp ? `Bewaard. +${xp} XP` : 'Bewaard.' }
}

/**
 * Connects a source (Plausible, Google, Stripe, Mollie, Discord, an own app) to a project. The key is checked (read-only keys only)
 * and kept in the local settings; an empty key field keeps the key that is already there.
 */
export async function saveConnector(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const projectId = String(form.get('projectId') ?? '')
  const kind = connectorKind(String(form.get('kind') ?? ''))
  if (!kind) return { ok: false, error: 'Kies een bron.' }
  const own = await ownProject(owner.userId, projectId)
  if (!own) return { ok: false, error: 'Dat project bestaat niet.' }
  const config: Record<string, string> = {}
  for (const field of kind.fields) {
    const value = String(form.get(field.name) ?? '')
      .trim()
      .slice(0, 200)
    if (field.required && !value) return { ok: false, error: `Vul ${field.label.toLowerCase()} in.` }
    if (field.options && value && !field.options.some((o) => o.value === value)) return { ok: false, error: `Kies ${field.label.toLowerCase()} uit de lijst.` }
    if (value) config[field.name] = value
  }
  const configProblem = kind.checkConfig?.(config)
  if (configProblem) return { ok: false, error: configProblem }
  const secret = String(form.get('secret') ?? '').trim()
  if (secret) {
    const problem = kind.checkSecret(secret)
    if (problem) return { ok: false, error: problem }
  }
  const { db } = own
  const [existing] = await db
    .select({ id: s.connector.id })
    .from(s.connector)
    .where(and(eq(s.connector.projectId, projectId), eq(s.connector.kind, kind.kind)))
  if (!existing && kind.secret && !kind.secret.optional && !secret) return { ok: false, error: `Vul ${kind.secret.label.toLowerCase()} in.` }
  const id = existing?.id ?? crypto.randomUUID()
  if (existing) await db.update(s.connector).set({ config, enabled: true, lastError: null }).where(eq(s.connector.id, id))
  else await db.insert(s.connector).values({ id, ownerId: owner.userId, projectId, kind: kind.kind, config })
  if (secret) await setSetting(db, owner.userId, connectorSecretKey(id), secret)
  refresh(projectId)
  return { ok: true, message: `${kind.label} gekoppeld. Druk op "Nu ophalen" voor de cijfers.` }
}

async function ownConnector(ownerId: string, connectorId: string) {
  const db = await getDb()
  const [row] = await db
    .select()
    .from(s.connector)
    .where(and(eq(s.connector.id, String(connectorId)), eq(s.connector.ownerId, ownerId)))
  return row ? { db, row } : null
}

/** Removes a source and its key; the numbers it delivered stay. */
export async function deleteConnector(connectorId: string): Promise<void> {
  const owner = await actionOwner()
  const own = await ownConnector(owner.userId, connectorId)
  if (!own) return
  await own.db.delete(s.connector).where(eq(s.connector.id, own.row.id))
  await setSetting(own.db, owner.userId, connectorSecretKey(own.row.id), null)
  refresh(own.row.projectId)
}

/** Reads the last week from a source without storing anything: does the key work? */
export async function testConnector(connectorId: string): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const own = await ownConnector(owner.userId, connectorId)
  if (!own) return { ok: false, message: 'Deze bron bestaat niet.' }
  const result = await pullConnector(own.db, owner.userId, own.row, { dryRun: true })
  return result.ok ? { ok: true, message: `Werkt: ${result.points} cijfers uit de laatste week.${result.note ? ` ${result.note}` : ''}` } : { ok: false, message: result.error ?? 'Dat lukte niet.' }
}

/** "Nu ophalen": every source of the project (or all projects) right away. */
export async function pullNow(projectId?: string): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const db = await getDb()
  const result = await pullAll(db, owner.userId, { projectId: projectId || undefined, force: true })
  if (projectId) refresh(projectId)
  else revalidatePath('/', 'layout')
  if (result.busy) return { ok: false, message: 'De cockpit haalt al cijfers op; probeer het zo nog eens.' }
  if (!result.pulled && !result.failed) return { ok: false, message: 'Er is nog geen bron gekoppeld.' }
  return {
    ok: result.failed === 0,
    message: `${result.pulled} bron${result.pulled === 1 ? '' : 'nen'} opgehaald, ${result.points} cijfers${result.failed ? `; ${result.failed} lukte niet (zie hieronder)` : ''}.`,
  }
}

/**
 * The Google service account, once for all projects (GA4 and Search Console). Only the e-mail address
 * ever comes back to a page; the key stays in the local settings.
 */
export async function saveGoogleAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const db = await getDb()
  if (form.get('remove') === '1') {
    await setSetting(db, owner.userId, GOOGLE_ACCOUNT_SETTING, null)
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Service-account verwijderd. GA4 en Search Console halen niets meer op tot je er een nieuw zet.' }
  }
  const text = String(form.get('account') ?? '').trim()
  if (!text) return { ok: false, error: 'Plak de hele inhoud van het JSON-sleutelbestand.' }
  if (text.length > 20_000) return { ok: false, error: 'Dat is te lang voor een sleutelbestand.' }
  const account = parseServiceAccount(text)
  if ('error' in account) return { ok: false, error: account.error }
  await setSetting(db, owner.userId, GOOGLE_ACCOUNT_SETTING, JSON.stringify({ type: 'service_account', ...account }))
  revalidatePath('/', 'layout')
  return { ok: true, message: `Bewaard: ${account.client_email}. Geef dit adres leesrechten in GA4 en Search Console.` }
}
