import 'server-only'
import { and, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayOf } from '@/lib/dates'
import { normalizePoints } from '@/lib/metrics'
import { rollupMonths, upsertPoints } from '../points'
import { getSetting } from '../settings'
import { fixturesAllowed } from '../status'
import { fixtureFetch } from './fixtures'
import { ConnectorError, connectorErrorText } from './http'
import { connectorKind, connectorSecretKey } from './index'

type ConnectorRow = typeof s.connector.$inferSelect

export interface PullResult {
  ok: boolean
  points: number
  error?: string
  note?: string
}

const MIN_GAP_MS = 10 * 60_000

const CONFIG_ERRORS: Record<string, string> = {
  profile: 'Vul het profiel-ID in (pfl_…).',
  site: 'Vul de site in, zoals hij in Plausible heet.',
  base: 'Een eigen server begint met https://.',
}

const fetchFor = (): typeof fetch => (fixturesAllowed() && process.env.COCKPIT_FAKE_CONNECTORS === '1' ? fixtureFetch : fetch)

/**
 * Pulls one source and stores what it delivers. A dry run (the "Test" button) reads only the last week
 * and stores nothing.
 */
export async function pullConnector(db: Db, ownerId: string, row: ConnectorRow, { now = new Date(), dryRun = false } = {}): Promise<PullResult> {
  const kind = connectorKind(row.kind)
  if (!kind) return { ok: false, points: 0, error: 'Onbekende bron.' }
  const secret = kind.secret ? await getSetting(db, ownerId, connectorSecretKey(row.id)) : ''
  if (kind.secret && !secret) return { ok: false, points: 0, error: 'Er is nog geen sleutel ingesteld.' }
  const today = dayOf(now)
  const back = dryRun ? 7 : row.lastOkAt ? kind.window.again : kind.window.first
  try {
    const pulled = await kind.pull({ config: row.config, secret: secret ?? '', from: addDays(today, -back), today, fetch: fetchFor() })
    const { ok, rejected } = normalizePoints(pulled.points, today)
    const note = [pulled.note, rejected.length ? `${rejected.length} cijfer(s) overgeslagen.` : ''].filter(Boolean).join(' ') || undefined
    if (!dryRun) {
      await upsertPoints(db, ownerId, row.projectId, kind.source, ok)
      await rollupMonths(db, ownerId, row.projectId, [...new Set(ok.map((p) => p.key))], now)
      await db.update(s.connector).set({ lastRunAt: now, lastOkAt: now, lastError: null }).where(eq(s.connector.id, row.id))
    }
    return { ok: true, points: ok.length, note }
  } catch (error) {
    const message = error instanceof ConnectorError ? connectorErrorText(error) : (CONFIG_ERRORS[(error as Error)?.message] ?? connectorErrorText(error))
    if (!dryRun) await db.update(s.connector).set({ lastRunAt: now, lastError: message }).where(eq(s.connector.id, row.id))
    return { ok: false, points: 0, error: message }
  }
}

/**
 * Pulls every enabled source of the owner (or of one project), one after another, never two rounds at
 * once and, unless forced, not again within ten minutes. Runs in the daily round and on "Nu ophalen".
 */
export async function pullAll(db: Db, ownerId: string, { projectId, force = false, now = new Date() }: { projectId?: string; force?: boolean; now?: Date } = {}): Promise<{ pulled: number; failed: number; points: number; busy?: boolean }> {
  const state = globalThis as unknown as { __cockpitPulling?: Set<string> }
  state.__cockpitPulling ??= new Set()
  if (state.__cockpitPulling.has(ownerId)) return { pulled: 0, failed: 0, points: 0, busy: true }
  state.__cockpitPulling.add(ownerId)
  try {
    const rows = await db
      .select()
      .from(s.connector)
      .where(and(eq(s.connector.ownerId, ownerId), eq(s.connector.enabled, true), ...(projectId ? [eq(s.connector.projectId, projectId)] : [])))
    let pulled = 0
    let failed = 0
    let points = 0
    for (const row of rows) {
      if (!force && row.lastRunAt && now.getTime() - row.lastRunAt.getTime() < MIN_GAP_MS) continue
      const result = await pullConnector(db, ownerId, row, { now })
      if (result.ok) {
        pulled++
        points += result.points
      } else failed++
    }
    return { pulled, failed, points }
  } finally {
    state.__cockpitPulling.delete(ownerId)
  }
}
