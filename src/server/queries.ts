import 'server-only'
import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { mergeCommitDays, type CommitDays } from '@/lib/activity'
import type { MetricTable } from '@/lib/money'
import type { MetricKey } from '@/lib/options'

export interface RepoBrief {
  id: string
  fullName: string
  projectId: string | null
  archived: boolean
  syncError: string | null
  syncedAt: Date | null
  pushedAt: Date | null
  stack: string[]
  includeInAi: boolean
}

export interface ProjectSummary {
  id: string
  name: string
  stage: string
  oneLiner: string
  siteUrl: string | null
  sortOrder: number
  companyId: string | null
  companyName: string | null
  companyColor: string
  repos: RepoBrief[]
  commitDays: CommitDays
}

const NO_COMPANY_COLOR = '#8a90b0'

/** All projects of the owner with their company and repositories (activity merged per project). */
export async function projectSummaries(db: Db, ownerId: string): Promise<ProjectSummary[]> {
  const projects = await db
    .select({
      id: s.project.id,
      name: s.project.name,
      stage: s.project.stage,
      oneLiner: s.project.oneLiner,
      siteUrl: s.project.siteUrl,
      sortOrder: s.project.sortOrder,
      companyId: s.project.companyId,
      companyName: s.company.name,
      companyColor: s.company.color,
    })
    .from(s.project)
    .leftJoin(s.company, eq(s.company.id, s.project.companyId))
    .where(eq(s.project.ownerId, ownerId))
    .orderBy(asc(s.project.sortOrder), asc(s.project.createdAt))
  const repos = await db
    .select({
      id: s.repo.id,
      fullName: s.repo.fullName,
      projectId: s.repo.projectId,
      archived: s.repo.archived,
      syncError: s.repo.syncError,
      syncedAt: s.repo.syncedAt,
      pushedAt: s.repo.pushedAt,
      stack: s.repo.stack,
      includeInAi: s.repo.includeInAi,
      commitDays: s.repo.commitDays,
    })
    .from(s.repo)
    .where(eq(s.repo.ownerId, ownerId))
  return projects.map((p) => {
    const own = repos.filter((r) => r.projectId === p.id)
    return {
      ...p,
      companyColor: p.companyColor ?? NO_COMPANY_COLOR,
      repos: own.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        projectId: r.projectId,
        archived: r.archived,
        syncError: r.syncError,
        syncedAt: r.syncedAt,
        pushedAt: r.pushedAt,
        stack: r.stack,
        includeInAi: r.includeInAi,
      })),
      commitDays: mergeCommitDays(own.map((r) => r.commitDays)),
    }
  })
}

/** metric values per project per month ('YYYY-MM-01'), from the given month on. */
export async function metricsSince(db: Db, ownerId: string, fromMonth: string, projectIds?: string[]): Promise<Record<string, MetricTable>> {
  const rows = await db
    .select({ projectId: s.metric.projectId, month: s.metric.month, key: s.metric.key, value: s.metric.value })
    .from(s.metric)
    .where(and(eq(s.metric.ownerId, ownerId), gte(s.metric.month, fromMonth), ...(projectIds?.length ? [inArray(s.metric.projectId, projectIds)] : [])))
  const out: Record<string, MetricTable> = {}
  for (const r of rows) {
    const table = (out[r.projectId] ??= {})
    const month = (table[r.month] ??= {})
    month[r.key as MetricKey] = r.value
  }
  return out
}

export async function companiesOf(db: Db, ownerId: string) {
  return db.select().from(s.company).where(eq(s.company.ownerId, ownerId)).orderBy(asc(s.company.sortOrder), asc(s.company.name))
}
