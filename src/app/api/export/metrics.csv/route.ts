import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { toCsv } from '@/lib/csv'
import { dayOf } from '@/lib/dates'
import { isMetricKey, METRIC_LABELS } from '@/lib/options'
import { getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/** Every number ever entered, one row per project, month and kind: for a spreadsheet or the accountant. */
export async function GET() {
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = await getDb()
  const rows = await db
    .select({ company: s.company.name, project: s.project.name, month: s.metric.month, key: s.metric.key, value: s.metric.value })
    .from(s.metric)
    .innerJoin(s.project, eq(s.project.id, s.metric.projectId))
    .leftJoin(s.company, eq(s.company.id, s.project.companyId))
    .where(eq(s.metric.ownerId, owner.userId))
    .orderBy(asc(s.metric.month), asc(s.company.name), asc(s.project.name), asc(s.metric.key))
  const csv = toCsv([
    ['bedrijf', 'project', 'maand', 'soort', 'waarde'],
    ...rows.map((r) => [r.company ?? '', r.project, r.month.slice(0, 7), isMetricKey(r.key) ? METRIC_LABELS[r.key] : r.key, r.value]),
  ])
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cockpit-cijfers-${dayOf(new Date())}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
