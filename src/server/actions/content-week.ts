'use server'

import { and, eq, gte, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { CONTENT_CHANNELS, normalizeRhythm } from '@/lib/ai/playbooks'
import { brandIssues, normalizeBrand } from '@/lib/brand'
import { slideText, type WeekBody } from '@/lib/content-week'
import { clean } from '@/lib/ai/schemas'
import { addDays, dayOf } from '@/lib/dates'
import { rhythmSettingKey } from '../content'
import { cancelPublish, runPublisher, schedulePublish } from '../publish/run'
import { renderItem, renderPending } from '../render/items'
import { actionOwner } from '../session'
import { setSetting } from '../settings'
import { award } from '../xp'
import type { FormState } from './types'

const refresh = () => {
  revalidatePath('/content')
  revalidatePath('/studio')
  revalidatePath('/')
}

async function ownItem(itemId: string) {
  const owner = await actionOwner()
  const db = await getDb()
  const [item] = await db
    .select()
    .from(s.contentItem)
    .where(and(eq(s.contentItem.id, String(itemId)), eq(s.contentItem.ownerId, owner.userId)))
  return item ? { db, owner, item, body: item.body as WeekBody } : null
}

/** Good to go: before publishing is connected, that means "klaar om te plaatsen". */
export async function approveItem(itemId: string): Promise<void> {
  const own = await ownItem(itemId)
  if (!own || own.item.status === 'done') return
  await own.db
    .update(s.contentItem)
    .set({ status: 'approved', body: { ...own.body, approvedAt: new Date().toISOString() } })
    .where(eq(s.contentItem.id, own.item.id))
  await schedulePublish(own.db, own.owner.userId, own.item.id)
  refresh()
}

/** Approves every post of the coming two weeks whose pictures are ready. */
export async function approveWeek(): Promise<{ approved: number }> {
  const owner = await actionOwner()
  const db = await getDb()
  const today = dayOf(new Date())
  const rows = await db
    .select()
    .from(s.contentItem)
    .where(and(eq(s.contentItem.ownerId, owner.userId), inArray(s.contentItem.kind, ['social', 'forum']), eq(s.contentItem.status, 'draft'), gte(s.contentItem.plannedFor, today)))
  let approved = 0
  for (const row of rows) {
    const body = row.body as WeekBody
    // Forum answers need no approval: he posts them himself.
    if (!body.week || row.kind === 'forum' || (row.plannedFor ?? '') > addDays(today, 13) || body.render?.status !== 'done') continue
    await db
      .update(s.contentItem)
      .set({ status: 'approved', body: { ...body, approvedAt: new Date().toISOString() } })
      .where(eq(s.contentItem.id, row.id))
    await schedulePublish(db, owner.userId, row.id)
    approved++
  }
  refresh()
  return { approved }
}

/** Not this one. */
export async function skipItem(itemId: string): Promise<void> {
  const own = await ownItem(itemId)
  if (!own) return
  await own.db.update(s.contentItem).set({ status: 'archived' }).where(eq(s.contentItem.id, own.item.id))
  await cancelPublish(own.db, own.owner.userId, own.item.id)
  refresh()
}

/** Back to a draft (after approving too soon). */
export async function unapproveItem(itemId: string): Promise<void> {
  const own = await ownItem(itemId)
  if (!own || own.item.status !== 'approved') return
  await own.db.update(s.contentItem).set({ status: 'draft' }).where(eq(s.contentItem.id, own.item.id))
  await cancelPublish(own.db, own.owner.userId, own.item.id)
  refresh()
}

/** He posted it himself (a forum answer, or a post while publishing is not connected yet). */
export async function markPosted(itemId: string): Promise<{ xp: number }> {
  const own = await ownItem(itemId)
  if (!own || own.item.status === 'done') return { xp: 0 }
  await own.db.update(s.contentItem).set({ status: 'done', doneAt: new Date() }).where(eq(s.contentItem.id, own.item.id))
  await cancelPublish(own.db, own.owner.userId, own.item.id)
  const xp = await award(own.db, own.owner.userId, { kind: 'post', refId: own.item.id, projectId: own.item.projectId })
  refresh()
  return { xp }
}

/** His edits to the text and the slides; the pictures are drawn again. */
export async function saveItemText(_prev: FormState, form: FormData): Promise<FormState> {
  const own = await ownItem(String(form.get('itemId') ?? ''))
  if (!own) return { ok: false, error: 'Dit item bestaat niet meer.' }
  if (own.item.status === 'done') return { ok: false, error: 'Dit is al geplaatst.' }
  // Changed after approving: back to a draft, and nothing goes out until he approves again.
  await cancelPublish(own.db, own.owner.userId, own.item.id)
  const body = { ...own.body }
  const hook = form.get('hook')
  const caption = form.get('caption')
  const answer = form.get('answer')
  if (typeof hook === 'string') body.hook = clean(hook, 220)
  if (typeof caption === 'string') body.caption = clean(caption, 3000)
  if (typeof answer === 'string' && body.forum) body.forum = { ...body.forum, answer: clean(answer, 4000) }
  if (body.slides?.length) {
    body.slides = body.slides.map((slide, i) => ({
      title: slideText(String(form.get(`slide-${i}-title`) ?? slide.title), 90) || slide.title,
      body: slideText(String(form.get(`slide-${i}-body`) ?? slide.body), 220),
    }))
  }
  if (body.reel) body.reel = { ...body.reel, coverText: slideText(String(form.get('coverText') ?? body.reel.coverText), 60) || body.reel.coverText }
  const redraw = body.contentFormat !== 'text' && body.contentFormat !== 'answer'
  await own.db
    .update(s.contentItem)
    .set({ body: { ...body, render: redraw ? { status: 'pending' } : body.render }, status: own.item.status === 'approved' ? 'draft' : own.item.status })
    .where(eq(s.contentItem.id, own.item.id))
  if (redraw) await renderItem(own.db, own.owner.userId, own.item.id)
  refresh()
  return { ok: true, message: redraw ? 'Bewaard en opnieuw getekend.' : 'Bewaard.' }
}

/** Draws an item again (after a failure, or a new house style). */
export async function redrawItem(itemId: string): Promise<void> {
  const own = await ownItem(itemId)
  if (!own) return
  await renderItem(own.db, own.owner.userId, own.item.id)
  refresh()
}

/**
 * A project's house style and rhythm. Drafts that are not approved yet are drawn again in the new
 * style, in the background.
 */
export async function saveBrandAndRhythm(_prev: FormState, form: FormData): Promise<FormState> {
  const owner = await actionOwner()
  const db = await getDb()
  const projectId = String(form.get('projectId') ?? '')
  const [project] = await db
    .select({ id: s.project.id, stage: s.project.stage, color: s.company.color })
    .from(s.project)
    .leftJoin(s.company, eq(s.company.id, s.project.companyId))
    .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, owner.userId)))
  if (!project) return { ok: false, error: 'Dat project bestaat niet.' }
  const brand = normalizeBrand(
    { bg: form.get('bg'), fg: form.get('fg'), accent: form.get('accent'), font: form.get('font'), style: form.get('style'), handle: form.get('handle') },
    project.color,
  )
  const rhythm = normalizeRhythm(Object.fromEntries(CONTENT_CHANNELS.map((c) => [c, Number(form.get(`rhythm-${c}`))])), project.stage)
  await db.update(s.project).set({ brand }).where(eq(s.project.id, project.id))
  await setSetting(db, owner.userId, rhythmSettingKey(project.id), JSON.stringify(rhythm))
  const drafts = await db
    .select({ id: s.contentItem.id, body: s.contentItem.body })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.projectId, project.id), eq(s.contentItem.kind, 'social'), eq(s.contentItem.status, 'draft')))
  for (const d of drafts) {
    const body = d.body as WeekBody
    if (body.week && body.render?.status === 'done') await db.update(s.contentItem).set({ body: { ...body, render: { status: 'pending' } } }).where(eq(s.contentItem.id, d.id))
  }
  void renderPending(db, owner.userId).catch(() => undefined)
  refresh()
  const issues = brandIssues(brand)
  return { ok: true, message: issues.length ? `Bewaard. Let op: ${issues.join(' ')}` : 'Bewaard. Nog niet goedgekeurde beelden worden opnieuw getekend.' }
}

/** The page saw pictures still waiting (after a restart, say): draw them now. */
export async function drawPending(): Promise<void> {
  const owner = await actionOwner()
  await renderPending(await getDb(), owner.userId)
}


/** The CapCut folder for a video: made (or made again) and opened. */
export async function makeCapcut(itemId: string): Promise<{ ok: boolean; message: string }> {
  const own = await ownItem(itemId)
  if (!own) return { ok: false, message: 'Dit item bestaat niet meer.' }
  const { buildCapcutPackage, openFolder } = await import('../capcut')
  const made = await buildCapcutPackage(own.db, own.owner.userId, own.item.id)
  if (!made.ok || !made.dir) return { ok: false, message: made.error ?? 'Dat lukte niet.' }
  openFolder(made.dir)
  refresh()
  return { ok: true, message: `Klaar: ${made.dir}. Open het in CapCut; LEESMIJ.md zegt hoe.` }
}

/** His export from CapCut becomes the video of the post. */
export async function importCapcut(itemId: string): Promise<{ ok: boolean; message: string }> {
  const own = await ownItem(itemId)
  if (!own) return { ok: false, message: 'Dit item bestaat niet meer.' }
  const { importExport } = await import('../capcut')
  const result = await importExport(own.db, own.owner.userId, own.item.id)
  refresh()
  return result.ok ? { ok: true, message: 'Je eigen versie staat erbij.' } : { ok: false, message: result.error ?? 'Dat lukte niet.' }
}

/** What a clip or photo shows, so Claude can pick the right one. */
export async function describeMedia(mediaId: string, description: string): Promise<void> {
  const owner = await actionOwner()
  const db = await getDb()
  await db
    .update(s.mediaAsset)
    .set({ description: clean(description, 300) })
    .where(and(eq(s.mediaAsset.id, String(mediaId)), eq(s.mediaAsset.ownerId, owner.userId), eq(s.mediaAsset.origin, 'upload')))
  refresh()
}

/** Removes one of his clips or photos (posts that used it keep their finished video). */
export async function removeMedia(mediaId: string): Promise<void> {
  const owner = await actionOwner()
  const { deleteMediaRow } = await import('../media')
  await deleteMediaRow(await getDb(), owner.userId, String(mediaId))
  refresh()
}

/** "Nu plaatsen": the approved post goes out right away (on his own account), not at its planned time. */
export async function publishNow(itemId: string): Promise<{ ok: boolean; message: string }> {
  const own = await ownItem(itemId)
  if (!own || own.item.status !== 'approved') return { ok: false, message: 'Keur hem eerst goed.' }
  const now = new Date()
  const scheduled = await schedulePublish(own.db, own.owner.userId, own.item.id, now)
  if (scheduled === 'manual') return { ok: false, message: 'Dit kanaal is nog niet gekoppeld (Instellingen → Kanalen); plaats hem met de hand.' }
  const [job] = await own.db
    .select({ id: s.publishJob.id })
    .from(s.publishJob)
    .where(and(eq(s.publishJob.contentItemId, own.item.id), eq(s.publishJob.status, 'queued')))
  if (!job) return { ok: false, message: 'Hij is al geplaatst of wordt nu geplaatst.' }
  await own.db.update(s.publishJob).set({ publishAt: now, nextTryAt: null }).where(eq(s.publishJob.id, job.id))
  const r = await runPublisher(own.db, own.owner.userId, now, { jobId: job.id })
  refresh()
  if (r.ran === 'published') return { ok: true, message: 'Geplaatst.' }
  if (r.ran === 'paused') return { ok: false, message: 'Plaatsen staat op pauze (Instellingen → Kanalen).' }
  return { ok: false, message: 'error' in r && r.error ? r.error : 'Dat lukte nu niet; de cockpit probeert het zo opnieuw.' }
}

/** After a failure he fixed (a new login, a token): try that post again now. */
export async function retryPublish(jobId: string): Promise<{ ok: boolean; message: string }> {
  const owner = await actionOwner()
  const db = await getDb()
  const [job] = await db
    .select()
    .from(s.publishJob)
    .where(and(eq(s.publishJob.id, String(jobId)), eq(s.publishJob.ownerId, owner.userId), eq(s.publishJob.status, 'failed')))
  if (!job) return { ok: false, message: 'Niets om opnieuw te proberen.' }
  const now = new Date()
  await db.update(s.publishJob).set({ status: 'queued', attempts: 0, nextTryAt: null, error: null, publishAt: now }).where(eq(s.publishJob.id, job.id))
  const r = await runPublisher(db, owner.userId, now, { jobId: job.id })
  refresh()
  return r.ran === 'published' ? { ok: true, message: 'Geplaatst.' } : { ok: false, message: 'error' in r && r.error ? r.error : 'Dat lukte nu niet.' }
}
