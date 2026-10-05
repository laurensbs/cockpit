import 'server-only'
import { and, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayOf } from '@/lib/dates'
import { bucketWeeks, lastOnOrBefore, lastWeeks, METRIC_DEFS, METRIC_KEYS, type MetricKey } from '@/lib/metrics'
import { connectorKind } from '../connectors'
import { outcomeStates, paceLine } from '../outcome-state'
import { dailySeries, loadPoints } from '../points'
import type { ProjectRef } from './projects'

const round = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100)

/**
 * The numbers of one project per week, as Claude reads them: what each metric is, where it comes from,
 * the weekly values and the latest one, the target's pace, and which sources work. Never a key.
 */
export async function numbersReport(db: Db, ownerId: string, project: ProjectRef, opts: { key?: MetricKey; weeks: number }, now = new Date()) {
  const today = dayOf(now)
  const weeks = lastWeeks(addDays(today, 7), opts.weeks)
  const [rows, connectors, outcomes] = await Promise.all([
    loadPoints(db, ownerId, addDays(weeks[0], -30), { projectIds: [project.id], ...(opts.key ? { keys: [opts.key] } : {}) }),
    db
      .select({ kind: s.connector.kind, enabled: s.connector.enabled, lastOkAt: s.connector.lastOkAt, lastError: s.connector.lastError })
      .from(s.connector)
      .where(and(eq(s.connector.projectId, project.id), eq(s.connector.ownerId, ownerId))),
    outcomeStates(db, ownerId, now),
  ])
  const outcome = outcomes.get(project.id)
  const metrics = METRIC_KEYS.filter((key) => (!opts.key || key === opts.key) && rows.some((r) => r.key === key)).map((key) => {
    const def = METRIC_DEFS[key]
    const daily = dailySeries(rows, project.id, key)
    const latest = lastOnOrBefore(daily, today)
    return {
      key,
      label: def.label,
      kind: def.agg === 'sum' ? 'flow' : 'level',
      unit: def.unit,
      sources: [...new Set(rows.filter((r) => r.key === key).map((r) => r.source))].sort(),
      weekly: bucketWeeks(daily, def, weeks).map(round),
      latest: latest ? { day: latest.day, value: round(latest.value) } : null,
    }
  })
  return {
    project: project.name,
    weeks,
    explain: 'weeks are Mondays, oldest first; the last one is the current week so far. A flow is the weekly total, a level the value at the end of the week. null means no number.',
    target: outcome?.model && outcome.pace ? paceLine(outcome.model, outcome.pace) : null,
    metrics,
    sources: connectors.map((c) => ({
      kind: c.kind,
      label: connectorKind(c.kind)?.label ?? c.kind,
      enabled: c.enabled,
      lastPulled: c.lastOkAt ? dayOf(c.lastOkAt) : null,
      error: c.lastError,
    })),
  }
}
