'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { COMPANY_KINDS, METRIC_KEYS } from '@/lib/options'
import { normalizeUrl } from '@/lib/urls'
import { actionOwner } from '../session'
import { award } from '../xp'
import type { FormState } from './types'

const companySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(COMPANY_KINDS),
  country: z.string().trim().max(40),
  registration: z.string().trim().max(120),
  website: z.string().trim().max(300),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  status: z.enum(['active', 'paused', 'archived']),
  notes: z.string().trim().max(4000),
})

export async function saveCompany(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = companySchema.safeParse({
    name: form.get('name'),
    kind: form.get('kind'),
    country: form.get('country') ?? '',
    registration: form.get('registration') ?? '',
    website: form.get('website') ?? '',
    color: form.get('color'),
    status: form.get('status') ?? 'active',
    notes: form.get('notes') ?? '',
  })
  if (!parsed.success) return { ok: false, error: 'Controleer de velden: een naam is nodig.' }
  const c = parsed.data
  const website = c.website ? normalizeUrl(c.website) : null
  if (c.website && !website) return { ok: false, error: 'Dat webadres klopt niet.' }
  const db = await getDb()
  const id = String(form.get('id') ?? '')
  const values = { ...c, country: c.country || null, website }
  if (id) {
    const [row] = await db
      .update(s.company)
      .set(values)
      .where(and(eq(s.company.id, id), eq(s.company.ownerId, owner.userId)))
      .returning({ id: s.company.id })
    if (!row) return { ok: false, error: 'Dit bedrijf bestaat niet (meer).' }
  } else {
    await db.insert(s.company).values({ id: crypto.randomUUID(), ownerId: owner.userId, ...values })
  }
  revalidatePath('/companies')
  revalidatePath('/projects')
  if (id) revalidatePath(`/companies/${id}`)
  return { ok: true, message: 'Opgeslagen.' }
}

/** Removes a company; its projects stay, without a company. */
export async function deleteCompany(companyId: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  await db.delete(s.company).where(and(eq(s.company.id, String(companyId)), eq(s.company.ownerId, owner.userId)))
  revalidatePath('/companies')
  revalidatePath('/projects')
  redirect('/companies')
}

const metricSchema = z.object({
  projectId: z.string().min(1).max(64),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  key: z.enum(METRIC_KEYS),
  value: z.coerce.number().min(-1e9).max(1e9),
})

/** One number per project per month; entering it again replaces it. */
export async function saveMetric(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const parsed = metricSchema.safeParse({
    projectId: form.get('projectId'),
    month: form.get('month'),
    key: form.get('key'),
    value: String(form.get('value') ?? '').replace(',', '.'),
  })
  if (!parsed.success) return { ok: false, error: 'Kies een project, een maand en een getal.' }
  const m = parsed.data
  const db = await getDb()
  const [project] = await db
    .select({ id: s.project.id, companyId: s.project.companyId })
    .from(s.project)
    .where(and(eq(s.project.id, m.projectId), eq(s.project.ownerId, owner.userId)))
  if (!project) return { ok: false, error: 'Dat project bestaat niet.' }
  const month = `${m.month}-01`
  await db
    .insert(s.metric)
    .values({ id: crypto.randomUUID(), ownerId: owner.userId, projectId: m.projectId, month, key: m.key, value: m.value, source: 'manual' })
    .onConflictDoUpdate({
      target: [s.metric.projectId, s.metric.month, s.metric.key],
      // What he types wins over what came in by itself, also later.
      set: { value: m.value, source: 'manual', updatedAt: new Date() },
    })
  const xp = await award(db, owner.userId, { kind: 'metric', refId: `${m.projectId}:${month}:${m.key}`, projectId: m.projectId })
  revalidatePath('/companies')
  revalidatePath('/')
  revalidatePath(`/projects/${m.projectId}`)
  if (project.companyId) revalidatePath(`/companies/${project.companyId}`)
  return { ok: true, message: xp ? `Bewaard. +${xp} XP` : 'Bewaard.' }
}
