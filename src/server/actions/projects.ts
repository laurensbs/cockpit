'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getDb, type Db } from '@/db'
import * as s from '@/db/schema'
import { COMPANY_COLORS, LANGUAGES, MARKETS, STAGES, isStage } from '@/lib/options'
import { STARTER_PROJECTS } from '@/lib/starter'
import { normalizeUrl, REPO_NAME } from '@/lib/urls'
import { isIntakeDone } from '../game'
import { syncRepo } from '../github/sync'
import { actionOwner } from '../session'
import { award } from '../xp'
import type { FormState } from './types'

const text = (max: number) => z.string().trim().max(max)

const projectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  companyId: z.string().max(64),
  newCompany: text(80),
  stage: z.enum(STAGES),
  oneLiner: text(200),
  what: text(2000),
  audience: text(1000),
  goal: text(600),
  tone: text(300),
  northStar: text(200),
  redLines: text(1000),
  siteUrl: text(300),
  localPath: text(400),
  languages: z.array(z.enum(LANGUAGES)).max(LANGUAGES.length),
  markets: z.array(z.enum(MARKETS)).max(MARKETS.length),
  monthlyBudget: z.union([z.literal(''), z.coerce.number().int().min(0).max(1_000_000)]),
})

/** A company of the owner by id, or null. Every action that links to a company checks this first. */
async function ownCompany(db: Db, ownerId: string, id: string) {
  if (!id) return null
  const [company] = await db
    .select({ id: s.company.id })
    .from(s.company)
    .where(and(eq(s.company.id, id), eq(s.company.ownerId, ownerId)))
  return company ?? null
}

async function newCompany(db: Db, ownerId: string, name: string, kind: string): Promise<string> {
  const existing = await db.select({ id: s.company.id }).from(s.company).where(eq(s.company.ownerId, ownerId))
  const id = crypto.randomUUID()
  await db.insert(s.company).values({
    id,
    ownerId,
    name,
    kind,
    color: COMPANY_COLORS[existing.length % COMPANY_COLORS.length],
    sortOrder: existing.length,
  })
  return id
}

export async function saveProject(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = projectSchema.safeParse({
    name: form.get('name'),
    companyId: form.get('companyId') ?? '',
    newCompany: form.get('newCompany') ?? '',
    stage: form.get('stage'),
    oneLiner: form.get('oneLiner') ?? '',
    what: form.get('what') ?? '',
    audience: form.get('audience') ?? '',
    goal: form.get('goal') ?? '',
    tone: form.get('tone') ?? '',
    northStar: form.get('northStar') ?? '',
    redLines: form.get('redLines') ?? '',
    siteUrl: form.get('siteUrl') ?? '',
    localPath: form.get('localPath') ?? '',
    languages: form.getAll('languages'),
    markets: form.getAll('markets'),
    monthlyBudget: form.get('monthlyBudget') ?? '',
  })
  if (!parsed.success) return { ok: false, error: 'Controleer de velden: een naam en een fase zijn nodig.' }
  const p = parsed.data
  const siteUrl = p.siteUrl ? normalizeUrl(p.siteUrl) : null
  if (p.siteUrl && !siteUrl) return { ok: false, error: 'Dat webadres klopt niet.' }

  const db = await getDb()
  const id = String(form.get('id') ?? '')
  const [existing] = id
    ? await db
        .select()
        .from(s.project)
        .where(and(eq(s.project.id, id), eq(s.project.ownerId, owner.userId)))
    : []
  if (id && !existing) return { ok: false, error: 'Dit project bestaat niet (meer).' }

  // A new project without a company gets its own; "__new" makes one with the given name; an
  // existing project may also have none.
  let companyId: string | null = null
  if (p.companyId === '__new' || (!existing && !p.companyId)) {
    companyId = await newCompany(db, owner.userId, p.newCompany || p.name, 'own')
  } else if (p.companyId) {
    companyId = (await ownCompany(db, owner.userId, p.companyId))?.id ?? null
    if (!companyId) return { ok: false, error: 'Dat bedrijf bestaat niet (meer).' }
  }

  const values = {
    name: p.name,
    companyId,
    stage: p.stage,
    oneLiner: p.oneLiner,
    what: p.what,
    audience: p.audience,
    goal: p.goal,
    tone: p.tone,
    northStar: p.northStar,
    redLines: p.redLines,
    siteUrl,
    localPath: p.localPath || null,
    languages: p.languages.length ? p.languages : ['nl'],
    markets: p.markets,
    monthlyBudget: p.monthlyBudget === '' ? null : p.monthlyBudget,
    updatedAt: new Date(),
  }
  let projectId = id
  if (existing) {
    await db.update(s.project).set(values).where(eq(s.project.id, id))
  } else {
    projectId = crypto.randomUUID()
    await db.insert(s.project).values({ id: projectId, ownerId: owner.userId, ...values })
  }
  if (isIntakeDone(values)) await award(db, owner.userId, { kind: 'intake', refId: projectId, projectId })
  revalidatePath('/projects')
  revalidatePath('/')
  redirect(`/projects/${projectId}`)
}

export async function setProjectStage(projectId: string, stage: string): Promise<void> {
  const owner = await actionOwner()
  if (!isStage(stage)) return
  const db = await getDb()
  await db
    .update(s.project)
    .set({ stage, updatedAt: new Date() })
    .where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
  revalidatePath('/projects')
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteProject(projectId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  await db.delete(s.project).where(and(eq(s.project.id, String(projectId)), eq(s.project.ownerId, owner.userId)))
  revalidatePath('/projects')
  redirect('/projects')
}

/**
 * The first visit: the projects he is building now go in at once, each with its own company,
 * linked to its repositories, and read from GitHub right away.
 */
export async function setupStarter(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const keys = new Set(form.getAll('starter').map(String))
  const chosen = STARTER_PROJECTS.filter((p) => keys.has(p.key))
  if (!chosen.length) return { ok: false, error: 'Kies minstens één project.' }
  const db = await getDb()
  const existing = await db.select({ id: s.project.id }).from(s.project).where(eq(s.project.ownerId, owner.userId))
  if (existing.length) redirect('/projects')

  const toSync: (typeof s.repo.$inferSelect)[] = []
  for (const [i, starter] of chosen.entries()) {
    const name = String(form.get(`name-${starter.key}`) ?? '').trim().slice(0, 80) || starter.name
    const companyId = await newCompany(db, owner.userId, name, starter.companyKind)
    const projectId = crypto.randomUUID()
    await db.insert(s.project).values({
      id: projectId,
      ownerId: owner.userId,
      companyId,
      name,
      stage: starter.stage,
      oneLiner: starter.oneLiner,
      languages: starter.languages,
      markets: starter.markets,
      redLines: starter.redLines,
      sortOrder: i,
    })
    const repos = String(form.get(`repos-${starter.key}`) ?? '')
      .split(/[\s,]+/)
      .map((r) => r.trim())
      .filter((r) => REPO_NAME.test(r))
    for (const fullName of [...new Set(repos)].slice(0, 5)) {
      const [row] = await db
        .insert(s.repo)
        .values({ id: crypto.randomUUID(), ownerId: owner.userId, projectId, fullName })
        .onConflictDoNothing()
        .returning()
      if (row) toSync.push(row)
    }
  }
  // Read GitHub now, within a time limit; whatever is left syncs on the next visit or tonight.
  const started = Date.now()
  for (const row of toSync) {
    if (Date.now() - started > 40_000) break
    await syncRepo(db, row)
  }
  revalidatePath('/projects')
  redirect('/projects')
}
