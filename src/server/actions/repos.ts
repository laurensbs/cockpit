'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { REPO_NAME } from '@/lib/urls'
import { syncAll, syncRepo } from '../github/sync'
import { actionOwner } from '../session'
import type { FormState } from './types'

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
