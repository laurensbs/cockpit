import 'server-only'
import { asc, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'

export interface ProjectRef {
  id: string
  name: string
}

/**
 * Claude names a project the way he does ("Rondje", "rondje", "the RSPS"); this finds the one he
 * means: by id, by exact name, or by a unique partial match. Anything else is a clear error that
 * lists the names it does know.
 */
export async function resolveProject(db: Db, ownerId: string, ref: string): Promise<ProjectRef | { error: string }> {
  const projects = await db
    .select({ id: s.project.id, name: s.project.name })
    .from(s.project)
    .where(eq(s.project.ownerId, ownerId))
    .orderBy(asc(s.project.sortOrder), asc(s.project.name))
  const wanted = ref.trim().toLowerCase()
  if (!wanted) return { error: `Which project? Known projects: ${projects.map((p) => p.name).join(', ') || 'none yet'}.` }
  const exact = projects.find((p) => p.id === ref.trim() || p.name.toLowerCase() === wanted)
  if (exact) return exact
  const partial = projects.filter((p) => p.name.toLowerCase().includes(wanted) || wanted.includes(p.name.toLowerCase()))
  if (partial.length === 1) return partial[0]
  return {
    error: partial.length
      ? `"${ref}" could mean several projects: ${partial.map((p) => p.name).join(', ')}. Use the exact name.`
      : `No project called "${ref}". Known projects: ${projects.map((p) => p.name).join(', ') || 'none yet'}.`,
  }
}
