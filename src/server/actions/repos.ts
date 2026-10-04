'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { COMPANY_COLORS } from '@/lib/options'
import { planImport } from '@/lib/import-plan'
import { normalizeUrl, REPO_NAME } from '@/lib/urls'
import { githubSource } from '../github/source'
import { syncAll, syncErrorText, syncRepo } from '../github/sync'
import { actionOwner } from '../session'
import { githubToken } from '../settings'
import type { FormState } from './types'

/**
 * Everything from GitHub in one go: new repositories are grouped into projects (each with its own
 * company, or all under the company he picks); relatives of known projects join those. Reading
 * them starts right away and carries on in the daily round.
 */
export async function importAllRepos(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const db = await getDb()
  const source = githubSource(await githubToken(db, owner.userId))
  if (!source) return { ok: false, error: 'Zet eerst een GitHub-token bij de instellingen.' }
  let all
  try {
    all = await source.listRepos()
  } catch (error) {
    return { ok: false, error: syncErrorText(error) }
  }
  const known = await db.select({ fullName: s.repo.fullName, projectId: s.repo.projectId }).from(s.repo).where(eq(s.repo.ownerId, owner.userId))
  const plan = planImport(all, new Map(known.map((r) => [r.fullName, r.projectId])), new Date())
  if (!plan.toExisting.length && !plan.newProjects.length) return { ok: true, message: 'Alles van GitHub staat er al in.' }

  const companyChoice = String(form.get('companyId') ?? '')
  const [chosen] = companyChoice
    ? await db
        .select({ id: s.company.id })
        .from(s.company)
        .where(and(eq(s.company.id, companyChoice), eq(s.company.ownerId, owner.userId)))
    : []
  const companies = await db.select({ id: s.company.id }).from(s.company).where(eq(s.company.ownerId, owner.userId))
  const projects = await db.select({ id: s.project.id }).from(s.project).where(eq(s.project.ownerId, owner.userId))
  const touched: string[] = []

  const link = async (projectId: string, names: string[]) => {
    for (const fullName of names) {
      const [row] = await db
        .insert(s.repo)
        .values({ id: crypto.randomUUID(), ownerId: owner.userId, projectId, fullName })
        .onConflictDoUpdate({ target: [s.repo.ownerId, s.repo.fullName], set: { projectId } })
        .returning({ id: s.repo.id })
      if (row) touched.push(row.id)
    }
  }
  for (const group of plan.toExisting) await link(group.projectId, group.names)
  for (const [i, p] of plan.newProjects.entries()) {
    let companyId = chosen?.id ?? null
    if (!companyId) {
      companyId = crypto.randomUUID()
      const n = companies.length + i
      await db.insert(s.company).values({ id: companyId, ownerId: owner.userId, name: p.name, kind: 'own', color: COMPANY_COLORS[n % COMPANY_COLORS.length], sortOrder: n })
    }
    const projectId = crypto.randomUUID()
    await db.insert(s.project).values({
      id: projectId,
      ownerId: owner.userId,
      companyId,
      name: p.name,
      stage: p.stage,
      oneLiner: p.oneLiner,
      siteUrl: p.siteUrl ? normalizeUrl(p.siteUrl) : null,
      sortOrder: projects.length + i,
    })
    await link(projectId, p.names)
  }

  // Read what fits in half a minute now; the daily round (stalest first) does the rest.
  const started = Date.now()
  const rows = touched.length ? await db.select().from(s.repo).where(inArray(s.repo.id, touched)) : []
  for (const row of rows) {
    if (Date.now() - started > 30_000) break
    await syncRepo(db, row)
  }
  revalidatePath('/projects')
  revalidatePath('/github')
  revalidatePath('/')
  const added = plan.toExisting.reduce((n, g) => n + g.names.length, 0) + plan.newProjects.reduce((n, p) => n + p.names.length, 0)
  return {
    ok: true,
    message: `${added} repo${added === 1 ? '' : "'s"} binnengehaald${plan.newProjects.length ? `: ${plan.newProjects.length} nieuw${plan.newProjects.length === 1 ? ' project' : 'e projecten'} (${plan.newProjects.map((p) => p.name).join(', ')})` : ''}.`,
  }
}

/** Adds repositories from GitHub to a project (or to none yet) and reads them right away. */
export async function importRepos(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const names = [...new Set(form.getAll('repo').map(String))].filter((n) => REPO_NAME.test(n)).slice(0, 50)
  if (!names.length) return { ok: false, error: 'Kies minstens één repo.' }
  const db = await getDb()
  const projectId = String(form.get('projectId') ?? '')
  if (projectId) {
    const [project] = await db
      .select({ id: s.project.id })
      .from(s.project)
      .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, owner.userId)))
    if (!project) return { ok: false, error: 'Dat project bestaat niet.' }
  }
  const rows = await db
    .insert(s.repo)
    .values(names.map((fullName) => ({ id: crypto.randomUUID(), ownerId: owner.userId, projectId: projectId || null, fullName })))
    .onConflictDoNothing()
    .returning()
  // Repos that were already in the cockpit move to the chosen project.
  if (projectId) {
    await db
      .update(s.repo)
      .set({ projectId })
      .where(and(eq(s.repo.ownerId, owner.userId), inArray(s.repo.fullName, names)))
  }
  const started = Date.now()
  let failed = 0
  for (const row of rows) {
    if (Date.now() - started > 40_000) break
    if (!(await syncRepo(db, row)).ok) failed++
  }
  revalidatePath('/projects')
  revalidatePath('/github')
  if (projectId) revalidatePath(`/projects/${projectId}`)
  return { ok: true, message: failed ? `${rows.length} toegevoegd; ${failed} kon GitHub nog niet lezen.` : `${names.length} gekoppeld.` }
}

/** Reads the repositories again: one project's, or all of them. */
export async function syncRepos(projectId?: string): Promise<{ synced: number; failed: number; left: number }> {
  const owner = await actionOwner()
  const db = await getDb()
  let result
  if (projectId) {
    const rows = await db
      .select()
      .from(s.repo)
      .where(and(eq(s.repo.ownerId, owner.userId), eq(s.repo.projectId, String(projectId))))
    let synced = 0
    let failed = 0
    for (const row of rows) {
      if ((await syncRepo(db, row)).ok) synced++
      else failed++
    }
    result = { synced, failed, left: 0 }
    revalidatePath(`/projects/${projectId}`)
  } else {
    result = await syncAll(db, owner.userId, 45_000)
  }
  revalidatePath('/projects')
  revalidatePath('/')
  return result
}

export async function assignRepo(repoId: string, projectId: string | null): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  if (projectId) {
    const [project] = await db
      .select({ id: s.project.id })
      .from(s.project)
      .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
    if (!project) return
  }
  await db
    .update(s.repo)
    .set({ projectId: projectId || null })
    .where(and(eq(s.repo.id, String(repoId)), eq(s.repo.ownerId, owner.userId)))
  revalidatePath('/projects')
  revalidatePath('/github')
  if (projectId) revalidatePath(`/projects/${projectId}`)
}

/** Whether a repository's README and docs may go to the AI (off for a client's code, say). */
export async function setRepoInAi(repoId: string, include: boolean): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [row] = await db
    .update(s.repo)
    .set({ includeInAi: Boolean(include) })
    .where(and(eq(s.repo.id, String(repoId)), eq(s.repo.ownerId, owner.userId)))
    .returning({ projectId: s.repo.projectId })
  if (row?.projectId) revalidatePath(`/projects/${row.projectId}`)
}

export async function removeRepo(repoId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  const [row] = await db
    .delete(s.repo)
    .where(and(eq(s.repo.id, String(repoId)), eq(s.repo.ownerId, owner.userId)))
    .returning({ projectId: s.repo.projectId })
  revalidatePath('/github')
  if (row?.projectId) revalidatePath(`/projects/${row.projectId}`)
}
